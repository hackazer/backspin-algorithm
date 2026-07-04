/**
 * Domain: attention scoring.
 *
 * Pure business logic, zero I/O. The minimal human-score gate for the MVP.
 *
 * AttentionScore = activity + focus + session_quality + workflow_relevance + trust_score - fraud_risk
 *
 * For the MVP we compute the first three signals from the window and hold the
 * remaining three at documented neutral constants. The full TrustRank and
 * fraud engine arrive in a later spec and only replace these constants; the
 * formula and the contract never change.
 *
 * Scoring runs after a window's end, never mid-generation.
 */

import {
  weightedAttention,
  type AttentionWindow,
  type AttentionScoreInputs,
  type NonEarningReason,
} from "../shared/index.js";
import { NEUTRAL_TRUST } from "./trust.js";
import { computeFraudRisk, FRAUD_REJECT_THRESHOLD } from "./fraud.js";
import { userReward, DEFAULT_REVENUE_SPLIT, type RevenueSplit } from "./revenue-split.js";

/** Neutral MVP constants for signals the full engine will compute later. */
export const MVP_WORKFLOW_RELEVANCE = 10;
/**
 * Neutral trust baseline, used when no TrustRank is supplied (a brand-new user
 * with no history). Equals the trust domain's NEUTRAL_TRUST so the default
 * matches the pre-TrustRank behavior exactly.
 */
export const MVP_TRUST_SCORE = NEUTRAL_TRUST;
export const MVP_FRAUD_RISK = 0;

/** A window must last at least this long to be eligible for reward. */
export const MIN_ELIGIBLE_SECONDS = 3;

/** Maximum contribution of the activity signal, in score points. */
const MAX_ACTIVITY_POINTS = 40;
/** Activity events needed to saturate the activity signal. */
const ACTIVITY_SATURATION = 20;
/** Score contribution when the surface was focused. */
const FOCUS_POINTS = 30;

/** Summary of a closed window, derived from its ticks. */
export interface WindowSummary {
  rawSeconds: number;
  focused: boolean;
  activityCount: number;
  /**
   * Seconds the discovery card was actually on screen, the precision unit
   * billing weights against. Derived from the `cardVisible` tick samples: of
   * the ticks that measured visibility, the fraction that were visible, applied
   * to rawSeconds. When NO tick measured visibility (older producers, or a
   * surface that cannot tell), this equals rawSeconds, so scoring is identical
   * to the focus-and-duration model that predates the signal.
   */
  visibleSeconds: number;
  /** True when at least one tick reported a `cardVisible` value. */
  visibilityMeasured: boolean;
  /**
   * True when any tick was timestamped outside [start, end] (a fabricated
   * sample). Computed in the single summarize pass so the fraud check does not
   * re-scan the ticks.
   */
  hasOutOfBoundsTick: boolean;
}

/**
 * Derive the scoring summary from a closed attention window.
 * Pure: no I/O. A window is "focused" if any tick observed focus, and
 * activityCount sums keyboard + mouse activity across ticks. When ticks carry
 * the optional `cardVisible` signal, visibleSeconds reflects the share of the
 * wait the card was genuinely on screen; otherwise it falls back to rawSeconds.
 */
export function summarizeWindow(window: AttentionWindow): WindowSummary {
  const end = window.end ?? window.start;
  const rawSeconds = Math.max(0, (end - window.start) / 1000);
  let focused = false;
  let activityCount = 0;
  let visibilitySamples = 0;
  let visibleSamples = 0;
  let hasOutOfBoundsTick = false;
  for (const tick of window.ticks) {
    if (tick.focused) focused = true;
    activityCount += tick.keyboardActivity + tick.mouseActivity;
    if (tick.cardVisible !== undefined) {
      visibilitySamples += 1;
      if (tick.cardVisible) visibleSamples += 1;
    }
    // A tick outside [start, end] could not have been sampled during the
    // window (a fabricated sample). Detected here so computeFraudRisk consumes
    // a precomputed flag rather than re-iterating the ticks.
    if (tick.timestamp < window.start || tick.timestamp > end) {
      hasOutOfBoundsTick = true;
    }
  }
  const visibilityMeasured = visibilitySamples > 0;
  // Proportional to the share of measured samples where the card was up. With
  // no measurement, treat the card as visible for the whole wait (legacy
  // behavior), so visibleSeconds == rawSeconds and nothing downstream shifts.
  const visibleFraction = visibilityMeasured
    ? visibleSamples / visibilitySamples
    : 1;
  const visibleSeconds = rawSeconds * visibleFraction;
  return {
    rawSeconds,
    focused,
    activityCount,
    visibleSeconds,
    visibilityMeasured,
    hasOutOfBoundsTick,
  };
}

/**
 * Build the AttentionScore inputs from a window summary and session validity.
 * session_quality is full when the session is valid, zero otherwise.
 * trust_score defaults to the neutral baseline; a caller with the user's
 * history passes a computed TrustRank. fraud_risk defaults to none; the caller
 * passes a computed risk to subtract.
 */
export function buildScoreInputs(
  summary: WindowSummary,
  sessionValid: boolean,
  trustScore: number = MVP_TRUST_SCORE,
  fraudRisk: number = MVP_FRAUD_RISK
): AttentionScoreInputs {
  const activity = Math.min(
    MAX_ACTIVITY_POINTS,
    (summary.activityCount / ACTIVITY_SATURATION) * MAX_ACTIVITY_POINTS
  );
  return {
    activity,
    focus: summary.focused ? FOCUS_POINTS : 0,
    session_quality: sessionValid ? 10 : 0,
    workflow_relevance: MVP_WORKFLOW_RELEVANCE,
    trust_score: trustScore,
    fraud_risk: fraudRisk,
  };
}

/**
 * Compute the AttentionScore from its inputs, clamped to 0-100.
 * Implements the published formula verbatim.
 */
export function attentionScore(inputs: AttentionScoreInputs): number {
  const raw =
    inputs.activity +
    inputs.focus +
    inputs.session_quality +
    inputs.workflow_relevance +
    inputs.trust_score -
    inputs.fraud_risk;
  return Math.max(0, Math.min(100, raw));
}

/** The full result of scoring a closed window. */
export interface ScoredWindow {
  rawSeconds: number;
  focused: boolean;
  activityCount: number;
  /** Seconds the card was actually on screen (== rawSeconds when unmeasured). */
  visibleSeconds: number;
  /** True when the producer reported card visibility for this window. */
  visibilityMeasured: boolean;
  attentionScore: number;
  weightedAttention: number;
  eligible: boolean;
  /** Computed fraud risk for the window (0-100). */
  fraudRisk: number;
  /**
   * When the window is ineligible, the FIRST gate it failed, as a shared
   * NonEarningReason. Undefined when the window is eligible. The ingest
   * use-case layers higher-level reasons (render failure, account block,
   * frequency cap) on top of this intrinsic verdict.
   */
  ineligibleReason?: NonEarningReason;
}

/**
 * Score a closed window end to end and decide reward eligibility.
 *
 * Eligible when: focused AND activity present AND session valid AND the wait
 * was at least MIN_ELIGIBLE_SECONDS AND fraud risk is below the reject
 * threshold. Ineligible windows are still stored, but they accrue no reward.
 *
 * trustScore defaults to the neutral baseline; the ingest use-case passes a
 * TrustRank computed from the user's prior window history. fraud_risk is
 * computed intrinsically from the window (no history needed).
 */
/**
 * Admin-tunable eligibility thresholds (reward_config). When omitted, the
 * documented defaults apply (MIN_ELIGIBLE_SECONDS, no human-score floor), so
 * the pure-domain behavior is unchanged for callers that do not pass config.
 */
export interface EligibilityConfig {
  /** Minimum wait length in seconds for a window to earn a reward. */
  minWaitSeconds?: number;
  /** Minimum AttentionScore (0-100) for a window to earn a reward. */
  minHumanScore?: number;
  /**
   * The server's wall clock at ingest (ms). Threaded into the fraud check so a
   * window with timestamps implausible against the server (future end, replay
   * reported long after it ended, inverted bounds) is penalized. Omitted in
   * pure unit tests, which keeps prior behavior.
   */
  serverNow?: number;
}

export function scoreWindow(
  window: AttentionWindow,
  sessionValid: boolean,
  trustScore: number = MVP_TRUST_SCORE,
  eligibility: EligibilityConfig = {}
): ScoredWindow {
  const summary = summarizeWindow(window);
  const fraudRisk = computeFraudRisk(window, summary, eligibility.serverNow);
  const inputs = buildScoreInputs(summary, sessionValid, trustScore, fraudRisk);
  const score = attentionScore(inputs);
  const minWait = eligibility.minWaitSeconds ?? MIN_ELIGIBLE_SECONDS;
  const minHuman = eligibility.minHumanScore ?? 0;
  const eligible =
    summary.focused &&
    summary.activityCount > 0 &&
    sessionValid &&
    summary.rawSeconds >= minWait &&
    score >= minHuman &&
    fraudRisk < FRAUD_REJECT_THRESHOLD;
  // Derive the FIRST failing gate as a user-facing reason. Order matches the
  // eligibility conjunction above so the explanation is the earliest cause.
  let ineligibleReason: NonEarningReason | undefined;
  if (!eligible) {
    if (!summary.focused) ineligibleReason = "not_focused";
    else if (summary.activityCount <= 0) ineligibleReason = "no_activity";
    else if (summary.rawSeconds < minWait) ineligibleReason = "below_min_wait";
    else if (score < minHuman) ineligibleReason = "below_min_score";
    else if (fraudRisk >= FRAUD_REJECT_THRESHOLD) ineligibleReason = "fraud_blocked";
    // sessionValid is gated upstream (InvalidSessionError), so it is not a
    // reason surfaced here; if it ever reaches this point it stays undefined
    // and the producer shows the generic non-earning sentence.
  }
  return {
    ineligibleReason,
    fraudRisk,
    rawSeconds: summary.rawSeconds,
    focused: summary.focused,
    activityCount: summary.activityCount,
    visibleSeconds: summary.visibleSeconds,
    visibilityMeasured: summary.visibilityMeasured,
    attentionScore: score,
    // Bill against the seconds the card was actually on screen, not wall-clock
    // window length. When visibility was unmeasured, visibleSeconds ==
    // rawSeconds, so this is identical to the prior behavior; when a producer
    // reports it, a card that was collapsed or scrolled away for part of the
    // wait earns proportionally less.
    weightedAttention: weightedAttention(summary.visibleSeconds, score),
    eligible,
  };
}

/** Reward unit conversion: 1 weighted attention-second -> this many credits. */
export const CREDITS_PER_WEIGHTED_SECOND = 1;

/**
 * Hard ceiling on the rewarded seconds of a SINGLE window. A real, attended AI
 * wait is seconds-to-minutes; nobody genuinely gives 20 focused minutes to one
 * discovery card. Capping the rewarded seconds per window means a forged or
 * absurd-duration window (e.g. a client that reports estimatedWaitSeconds=3600
 * and a duration just under the fraud ratio) cannot cash out a large payout even
 * if it clears the eligibility gate. Generous enough (5 min) that no honest wait
 * is ever clipped. This is a deterministic anti-abuse bound, complementary to
 * the (private) fraud engine and the per-account daily cap.
 */
export const MAX_REWARDED_SECONDS_PER_WINDOW = 300;

/**
 * Gross reward for a scored window, before the revenue split. Zero when
 * ineligible. This is the total value the verified attention generated, bounded
 * by MAX_REWARDED_SECONDS_PER_WINDOW so no single window can pay beyond a
 * plausible attention span.
 */
export function grossReward(scored: ScoredWindow): number {
  if (!scored.eligible) return 0;
  // weightedAttention == visibleSeconds * (score/100); the ceiling caps the
  // seconds term, so the bound scales with the same quality score.
  const ceiling = MAX_REWARDED_SECONDS_PER_WINDOW * (scored.attentionScore / 100);
  const bounded = Math.min(scored.weightedAttention, ceiling);
  return bounded * CREDITS_PER_WEIGHTED_SECOND;
}

/**
 * The user's reward for a scored window: the gross discounted by the revenue
 * split (economics.md: default 50% to the user). Zero when ineligible. The
 * reward row credited to the user is this user share, not the gross.
 */
export function rewardAmount(
  scored: ScoredWindow,
  split: RevenueSplit = DEFAULT_REVENUE_SPLIT
): number {
  return userReward(grossReward(scored), split);
}
