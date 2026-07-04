/**
 * Domain: fraud risk - PUBLIC TEMPLATE STUB.
 *
 * This file is a STUB in the open-source mirror. The real fraud / anti-abuse
 * engine is the ONE deliberately-closed part of BackSpin's open-trust split:
 * the methodology is documented (a per-window fraud_risk penalty subtracted
 * from the published AttentionScore), but the exact signals, weights, and
 * thresholds stay private so they cannot be gamed. Everything else in this
 * package is the real, production formula, verbatim.
 *
 * Where it plugs in - `fraud_risk` is the term SUBTRACTED in the published
 * AttentionScore formula:
 *
 *   AttentionScore = activity + focus + session_quality
 *                    + workflow_relevance + trust_score − fraud_risk
 *
 * `fraud_risk` is a 0–100 penalty: 0 means "no fraud detected" (the normal
 * case for genuine human attention), higher means more suspicious, and a window
 * at or above FRAUD_REJECT_THRESHOLD earns no reward at all.
 *
 * This stub returns 0 for every window - i.e. it treats all attention as clean.
 * That makes the open algorithm reproduce production EXACTLY for honest traffic
 * (production also returns ~0 there); only the abuse-detection path differs.
 *
 * Secrecy invariant (enforced by `sync.mjs`): the body of computeFraudRisk in
 * the public mirror MUST stay `return 0;`. The sync fails if it contains
 * anything else, so a careless edit can never leak real detection logic. The
 * real engine lives in the private monorepo and is never copied here.
 */

import type { AttentionWindow } from "@usebackspin/shared";
import type { WindowSummary } from "./scoring.js";

/** A window scoring at or above this fraud risk is rejected (no reward). */
export const FRAUD_REJECT_THRESHOLD = 50;

/**
 * Compute a window's fraud risk in [0, 100]. PUBLIC STUB: always 0.
 *
 * The real implementation returns a graded penalty from private signals; this
 * stub reveals nothing about what those signals are. The parameter list mirrors
 * the real engine's arity so the verbatim `scoring.ts` compiles unchanged.
 */
export function computeFraudRisk(
  _window: AttentionWindow,
  _summary: WindowSummary,
  _serverNow?: number
): number {
  return 0;
}
