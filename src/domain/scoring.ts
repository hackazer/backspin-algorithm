import { weightedAttention, type AttentionWindow, type AttentionScoreInputs, type NonEarningReason, } from "../shared/index.js";
import { NEUTRAL_TRUST } from "./trust.js";
import { computeFraudRisk, FRAUD_REJECT_THRESHOLD } from "./fraud.js";
import { userReward, DEFAULT_REVENUE_SPLIT, type RevenueSplit } from "./revenue-split.js";
export declare const MVP_WORKFLOW_RELEVANCE: number;
export const MVP_TRUST_SCORE = NEUTRAL_TRUST;
export declare const MVP_FRAUD_RISK: number;
export declare const MIN_ELIGIBLE_SECONDS: number;
declare const MAX_ACTIVITY_POINTS: number;
declare const ACTIVITY_SATURATION: number;
declare const FOCUS_POINTS: number;
export interface WindowSummary {
    rawSeconds: number;
    focused: boolean;
    activityCount: number;
    visibleSeconds: number;
    visibilityMeasured: boolean;
    hasOutOfBoundsTick: boolean;
}
export function summarizeWindow(window: AttentionWindow): WindowSummary {
    const end = window.end ?? window.start;
    const rawSeconds = Math.max(0, (end - window.start) / 1000);
    let focused = false;
    let activityCount = 0;
    let visibilitySamples = 0;
    let visibleSamples = 0;
    let hasOutOfBoundsTick = false;
    for (const tick of window.ticks) {
        if (tick.focused)
            focused = true;
        activityCount += tick.keyboardActivity + tick.mouseActivity;
        if (tick.cardVisible !== undefined) {
            visibilitySamples += 1;
            if (tick.cardVisible)
                visibleSamples += 1;
        }
        if (tick.timestamp < window.start || tick.timestamp > end) {
            hasOutOfBoundsTick = true;
        }
    }
    const visibilityMeasured = visibilitySamples > 0;
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
export function buildScoreInputs(summary: WindowSummary, sessionValid: boolean, trustScore: number = MVP_TRUST_SCORE, fraudRisk: number = MVP_FRAUD_RISK): AttentionScoreInputs {
    const activity = Math.min(MAX_ACTIVITY_POINTS, (summary.activityCount / ACTIVITY_SATURATION) * MAX_ACTIVITY_POINTS);
    return {
        activity,
        focus: summary.focused ? FOCUS_POINTS : 0,
        session_quality: sessionValid ? 10 : 0,
        workflow_relevance: MVP_WORKFLOW_RELEVANCE,
        trust_score: trustScore,
        fraud_risk: fraudRisk,
    };
}
export function attentionScore(inputs: AttentionScoreInputs): number {
    const raw = inputs.activity +
        inputs.focus +
        inputs.session_quality +
        inputs.workflow_relevance +
        inputs.trust_score -
        inputs.fraud_risk;
    return Math.max(0, Math.min(100, raw));
}
export interface ScoredWindow {
    rawSeconds: number;
    focused: boolean;
    activityCount: number;
    visibleSeconds: number;
    visibilityMeasured: boolean;
    rewardedVisibleSeconds: number;
    attentionScore: number;
    weightedAttention: number;
    rewardedWeightedAttention: number;
    eligible: boolean;
    fraudRisk: number;
    ineligibleReason?: NonEarningReason;
}
export interface EligibilityConfig {
    minWaitSeconds?: number;
    minHumanScore?: number;
    maxRewardedSecondsPerWindow?: number;
    serverNow?: number;
}
export function scoreWindow(window: AttentionWindow, sessionValid: boolean, trustScore: number = MVP_TRUST_SCORE, eligibility: EligibilityConfig = {}): ScoredWindow {
    const summary = summarizeWindow(window);
    const fraudRisk = computeFraudRisk(window, summary, eligibility.serverNow);
    const inputs = buildScoreInputs(summary, sessionValid, trustScore, fraudRisk);
    const score = attentionScore(inputs);
    const minWait = eligibility.minWaitSeconds ?? MIN_ELIGIBLE_SECONDS;
    const minHuman = eligibility.minHumanScore ?? 0;
    const maxRewardedSeconds = Math.max(0, Math.min(eligibility.maxRewardedSecondsPerWindow ?? DEFAULT_REWARDED_SECONDS_PER_WINDOW, MAX_REWARDED_SECONDS_PER_WINDOW));
    const eligible = summary.focused &&
        summary.activityCount > 0 &&
        sessionValid &&
        summary.rawSeconds >= minWait &&
        score >= minHuman &&
        fraudRisk < FRAUD_REJECT_THRESHOLD;
    let ineligibleReason: NonEarningReason | undefined;
    if (!eligible) {
        if (!summary.focused)
            ineligibleReason = "not_focused";
        else if (summary.activityCount <= 0)
            ineligibleReason = "no_activity";
        else if (summary.rawSeconds < minWait)
            ineligibleReason = "below_min_wait";
        else if (score < minHuman)
            ineligibleReason = "below_min_score";
        else if (fraudRisk >= FRAUD_REJECT_THRESHOLD)
            ineligibleReason = "fraud_blocked";
    }
    return {
        ineligibleReason,
        fraudRisk,
        rawSeconds: summary.rawSeconds,
        focused: summary.focused,
        activityCount: summary.activityCount,
        visibleSeconds: summary.visibleSeconds,
        visibilityMeasured: summary.visibilityMeasured,
        rewardedVisibleSeconds: Math.min(summary.visibleSeconds, maxRewardedSeconds),
        attentionScore: score,
        weightedAttention: weightedAttention(summary.visibleSeconds, score),
        rewardedWeightedAttention: weightedAttention(Math.min(summary.visibleSeconds, maxRewardedSeconds), score),
        eligible,
    };
}
export declare const CREDITS_PER_WEIGHTED_SECOND: number;
export declare const DEFAULT_REWARDED_SECONDS_PER_WINDOW: number;
export declare const MAX_REWARDED_SECONDS_PER_WINDOW: number;
export function grossReward(scored: ScoredWindow): number {
    if (!scored.eligible)
        return 0;
    return scored.rewardedWeightedAttention * CREDITS_PER_WEIGHTED_SECOND;
}
export function rewardAmount(scored: ScoredWindow, split: RevenueSplit = DEFAULT_REVENUE_SPLIT): number {
    return userReward(grossReward(scored), split);
}
