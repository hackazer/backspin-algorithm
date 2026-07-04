/**
 * Domain: revenue split between the user and BackSpin.
 *
 * Pure business logic, zero I/O. From economics.md (Revenue Split):
 *
 *   "The revenue split is configurable. The default is 50% to the user and 50%
 *    to BackSpin. Splits support per-surface, per-partner, and per-campaign
 *    overrides."
 *
 * A scored window produces a gross reward (weighted attention-seconds in
 * credits). That gross is split: the user earns their share, BackSpin keeps
 * the rest, and a partner (a revenue-sharing surface) can carry an override
 * that takes a cut from BackSpin's portion. The full per-surface/per-campaign
 * override store is a later phase (revenue_splits, Phase 5); this module is the
 * pure split math the reward path uses now, with the documented default.
 */

// The default shares are defined ONCE in @usebackspin/shared (economics.ts) so
// the "50% to you" number can never drift between the reward path, the admin
// dashboard, marketing, and docs. Imported here and re-exported for the domain
// callers that already reference them from this module.
import { DEFAULT_USER_SHARE, DEFAULT_PARTNER_SHARE } from "../shared/index.js";
export { DEFAULT_USER_SHARE, DEFAULT_PARTNER_SHARE };

/** A configured split. Shares are fractions of gross in [0, 1]. */
export interface RevenueSplit {
  /** Fraction of gross paid to the user. */
  userShare: number;
  /**
   * Fraction of gross paid to a revenue-sharing partner surface (e.g. an
   * extension that hosts attention). Comes out of the non-user remainder.
   */
  partnerShare: number;
}

/** The documented default split: 50% user, 0% partner, 50% BackSpin. */
export const DEFAULT_REVENUE_SPLIT: RevenueSplit = {
  userShare: DEFAULT_USER_SHARE,
  partnerShare: DEFAULT_PARTNER_SHARE,
};

/** How a gross reward divides across the parties. */
export interface SplitResult {
  /** Gross reward before the split. */
  gross: number;
  /** Credits paid to the user. */
  user: number;
  /** Credits paid to a partner surface (0 by default). */
  partner: number;
  /** Credits retained by BackSpin (the remainder). */
  backspin: number;
}

/** Clamp a share fraction to [0, 1]. */
function clampShare(share: number): number {
  return Math.max(0, Math.min(1, share));
}

/**
 * Split a gross reward across user, partner, and BackSpin.
 *
 * userShare and partnerShare are clamped to [0, 1] and, if they would sum past
 * 1, partnerShare is reduced so the user is always paid in full first and
 * BackSpin's remainder never goes negative. A non-positive gross splits to
 * zero everywhere.
 */
export function splitRevenue(
  gross: number,
  split: RevenueSplit = DEFAULT_REVENUE_SPLIT
): SplitResult {
  if (gross <= 0) {
    return { gross: 0, user: 0, partner: 0, backspin: 0 };
  }
  const userShare = clampShare(split.userShare);
  const partnerShare = Math.min(clampShare(split.partnerShare), 1 - userShare);
  const user = gross * userShare;
  const partner = gross * partnerShare;
  const backspin = gross - user - partner;
  return { gross, user, partner, backspin };
}

/** The user's reward from a gross amount under a split (the credited portion). */
export function userReward(
  gross: number,
  split: RevenueSplit = DEFAULT_REVENUE_SPLIT
): number {
  return splitRevenue(gross, split).user;
}
