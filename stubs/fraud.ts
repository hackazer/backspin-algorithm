/**
 * Domain: fraud risk - PUBLIC TEMPLATE STUB.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ This file is a STUB in the open-source mirror. The real fraud / anti-abuse │
 * │ engine is the ONE deliberately-closed part of BackSpin's open-trust split: │
 * │ the methodology is documented, but the exact signals and thresholds stay   │
 * │ private so they cannot be gamed. Everything else in this package is the    │
 * │ real, production formula, verbatim.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Where it plugs in - `fraud_risk` is the term SUBTRACTED in the published
 * AttentionScore formula:
 *
 *   AttentionScore = activity + focus + session_quality
 *                    + workflow_relevance + trust_score − fraud_risk
 *
 * So `fraud_risk` is a 0–100 penalty: 0 means "no fraud detected" (the normal
 * case for genuine human attention), higher means more suspicious, and a window
 * at or above FRAUD_REJECT_THRESHOLD earns no reward at all.
 *
 * This stub returns 0 for every window - i.e. it treats all attention as clean.
 * That makes the open algorithm reproduce production EXACTLY for honest traffic
 * (production also returns ~0 there); only the abuse-detection path differs. The
 * real engine inspects per-window and cross-window signals (activity plausibility,
 * tick integrity, duration vs. estimate, device/network heuristics, account
 * cohorts) and is intentionally not shipped here.
 */

import type { AttentionWindow } from "@usebackspin/shared";
import type { WindowSummary } from "./scoring.js";

/** A window scoring at or above this fraud risk is rejected (no reward). */
export const FRAUD_REJECT_THRESHOLD = 50;

/**
 * Compute a window's fraud risk in [0, 100]. PUBLIC STUB: always 0.
 *
 * The real implementation returns a graded penalty. Illustrative shape of what
 * a real engine would return (NOT the production logic - examples only):
 *
 *   return 0;   // clean: a normal human wait. No penalty. (what this stub does)
 *   return 25;  // mildly suspicious: one soft signal tripped → smaller reward.
 *   return 60;  // strongly suspicious: ≥ FRAUD_REJECT_THRESHOLD → no reward.
 *   return 100; // certain abuse (e.g. fabricated ticks, bot-rate activity).
 *
 * A worked example of how a real engine MIGHT accumulate points (again, the
 * production weights/conditions are private):
 *
 *   let risk = 0;
 *   if (looksSuperhuman(summary))       risk += 60; // bot hammering input
 *   if (hasTicksOutsideWindow(window))  risk += 60; // fabricated samples
 *   if (durationFarBeyondEstimate(...)) risk += 40; // surface left open to farm
 *   return Math.max(0, Math.min(100, risk));
 *
 * @param _window    the closed attention window (unused in the stub)
 * @param _summary   the window's computed summary (unused in the stub)
 * @param _serverNow the server's wall clock at ingest in ms (unused in the stub;
 *                   the real engine penalizes windows whose timestamps are
 *                   implausible against it)
 * @returns 0 - no fraud signal in the open mirror.
 */
export function computeFraudRisk(
  _window: AttentionWindow,
  _summary: WindowSummary,
  _serverNow?: number
): number {
  // Public mirror: no abuse heuristics. Honest attention scores identically to
  // production; the real graded penalty lives in private engineering.
  return 0;
}
