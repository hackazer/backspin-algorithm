/**
 * BackSpin house ad + the non-earning reason vocabulary.
 *
 * Two related ideas live here because they share one purpose: being honest with
 * the developer about a wait that did not (or cannot) earn.
 *
 *   1. NonEarningReason - a small, closed vocabulary the SERVER stamps on an
 *      ingest result when a window earns nothing. The producer only relays it;
 *      it never recomputes eligibility or learns the admin thresholds. Keeps
 *      the spine authoritative while letting every surface explain "shown, not
 *      earned" in plain words.
 *
 *   2. houseCard() - BackSpin's own discovery card, shown deterministically
 *      where a paid card cannot or should not run: an empty no-fill batch, or a
 *      low-confidence (manual) wait the honesty gate will refuse to ship. It
 *      carries the HOUSE_CAMPAIGN_ID sentinel, which by design resolves to no
 *      real campaign server-side, so it records no impression, bills no
 *      advertiser, and earns no reward. A filler that is honest by construction.
 */

import type { RankedCard } from "./cache.js";

/**
 * Why a closed window earned no reward. Computed server-side from gates that
 * already exist; the producer surfaces it verbatim. Ordered loosely by how
 * early the gate trips.
 */
export type NonEarningReason =
  /** A card was selected but never painted, so no attention was delivered. */
  | "render_failed"
  /** The wait was shorter than the admin's minimum eligible seconds. */
  | "below_min_wait"
  /** The computed AttentionScore was under the admin's minimum. */
  | "below_min_score"
  /** No focus was observed during the wait. */
  | "not_focused"
  /** No keyboard/mouse activity was observed during the wait. */
  | "no_activity"
  /** Fraud risk for the window exceeded the reject threshold. */
  | "fraud_blocked"
  /** The account is blocked by the anti-farm engine. */
  | "account_blocked"
  /** The user already hit the admin's rewarded-window frequency cap. */
  | "frequency_cap"
  /** Too many windows from this account in a short span (velocity cap). */
  | "velocity_cap"
  /** An unclaimed account hit its pre-claim lifetime earning ceiling. */
  | "unclaimed_cap";

/** A short, user-facing sentence for each non-earning reason. */
export const NON_EARNING_REASON_TEXT: Record<NonEarningReason, string> = {
  render_failed: "the card could not be shown, so nothing was billed",
  below_min_wait: "the wait was too short to earn",
  below_min_score: "the attention score was below the minimum",
  not_focused: "the editor was not focused during the wait",
  no_activity: "no activity was detected during the wait",
  fraud_blocked: "the window did not pass the integrity check",
  account_blocked: "this account is under review",
  frequency_cap: "you have reached the reward cap for now",
  velocity_cap: "too many waits in a short time; slowing down to keep it fair",
  unclaimed_cap: "claim your account with your email to keep earning",
};

/** Map a reason to its short sentence, with a safe fallback. */
export function nonEarningReasonText(reason: NonEarningReason | undefined): string {
  if (!reason) return "this wait earned no reward";
  return NON_EARNING_REASON_TEXT[reason] ?? "this wait earned no reward";
}

/**
 * Account-level reasons worth a PERSISTENT, user-facing notification across
 * every surface (CLI, browser, editor): the account is blocked, or it has hit a
 * cap so further waits earn nothing until something changes. These are distinct
 * from the transient per-window reasons (too short, not focused, no activity,
 * render failed, below score) which are normal noise and must NOT nag the user.
 */
export const NOTICEWORTHY_REASONS: ReadonlySet<NonEarningReason> = new Set<NonEarningReason>([
  "account_blocked",
  "frequency_cap",
  "velocity_cap",
  "unclaimed_cap",
  "fraud_blocked",
]);

/** True when a reason deserves a persistent cross-surface notification. */
export function isNoticeworthyReason(reason: NonEarningReason | undefined): reason is NonEarningReason {
  return reason !== undefined && NOTICEWORTHY_REASONS.has(reason);
}

/** A short title + body for a non-earning NOTIFICATION, or null when not noticeworthy. */
export interface NonEarningNotice {
  reason: NonEarningReason;
  /** One-line headline for a toast/badge. */
  title: string;
  /** A sentence explaining what to do next. */
  body: string;
  /** True when the user can act to resume earning (claim account, wait out cap). */
  actionable: boolean;
}

const NOTICE_TITLES: Record<NonEarningReason, string> = {
  account_blocked: "Earning paused — account under review",
  frequency_cap: "Daily reward cap reached",
  velocity_cap: "Slowing down to keep it fair",
  unclaimed_cap: "Claim your account to keep earning",
  fraud_blocked: "A wait didn't pass the integrity check",
  // The transient ones are never surfaced as notices, but keep the map total.
  render_failed: "",
  below_min_wait: "",
  below_min_score: "",
  not_focused: "",
  no_activity: "",
};

const NOTICE_BODIES: Record<NonEarningReason, string> = {
  account_blocked:
    "Your account is under anti-farm review, so waits are shown but earn nothing right now. If this looks wrong, contact support from your BackSpin dashboard.",
  frequency_cap:
    "You've hit the rewarded-window cap for now. Discovery cards keep showing; earning resumes automatically when the cap window rolls over.",
  velocity_cap:
    "A lot of waits arrived in a short span, so earning is briefly throttled to keep things fair. It resumes on its own shortly.",
  unclaimed_cap:
    "This unclaimed account reached its pre-claim earning ceiling. Claim it with your email at usebackspin.com to lift the cap and keep your rewards.",
  fraud_blocked:
    "The last wait didn't pass the integrity check, so it earned nothing. Normal use resumes automatically.",
  render_failed: "",
  below_min_wait: "",
  below_min_score: "",
  not_focused: "",
  no_activity: "",
};

/**
 * Build a user-facing notice for a non-earning reason, or null when the reason
 * is transient/absent. Every surface renders this the same way, so the wording
 * stays consistent from the terminal to the browser popup to the editor toast.
 */
export function nonEarningNotice(reason: NonEarningReason | undefined): NonEarningNotice | null {
  if (!isNoticeworthyReason(reason)) return null;
  return {
    reason,
    title: NOTICE_TITLES[reason],
    body: NOTICE_BODIES[reason],
    actionable: reason === "unclaimed_cap",
  };
}

/**
 * Sentinel campaign + card ids for the BackSpin house ad. Chosen so they can
 * never collide with a real campaign id: the server resolves them to no
 * campaign, which is exactly why the house card bills and earns nothing.
 */
export const HOUSE_CAMPAIGN_ID = "backspin-house";
export const HOUSE_CARD_ID = "backspin-house-card";

/**
 * Absolute URL to the BackSpin logo used on the house card, so DOM surfaces (VS
 * Code webview, browser overlay) render the REAL logo by default instead of a
 * letter mark. Overridable for self-hosted/dev via `BACKSPIN_LOGO_URL`. Must be
 * https + absolute because the overlay only loads https logos.
 */
export const HOUSE_LOGO_URL = resolveHouseLogoUrl();

function resolveHouseLogoUrl(): string {
  // `shared` is cross-surface (no node types), so read env via globalThis.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return env?.BACKSPIN_LOGO_URL || "https://usebackspin.com/icon-192.png";
}

/**
 * The two rotating house messages. Index 0 speaks to developers (earn), index 1
 * speaks to advertisers (reach), so the same slot recruits both sides.
 */
export const HOUSE_AD_VARIANTS: ReadonlyArray<{ title: string; cta: string; url: string }> = [
  {
    title: "Get paid while you wait",
    cta: "Earn with BackSpin",
    url: "https://usebackspin.com",
  },
  {
    title: "Get your ad attention while they load",
    cta: "Advertise on BackSpin",
    url: "https://usebackspin.com/advertisers",
  },
];

/**
 * Build the BackSpin house card as a normal RankedCard, so every surface can
 * render it through its existing card path with zero special-casing. `variant`
 * selects the rotating copy (defaults to 0 = the developer/earn message);
 * out-of-range indices wrap. Text-tier by construction so it renders on every
 * surface, including the terminal.
 */
export function houseCard(variant = 0): RankedCard {
  const v = HOUSE_AD_VARIANTS[((variant % HOUSE_AD_VARIANTS.length) + HOUSE_AD_VARIANTS.length) % HOUSE_AD_VARIANTS.length]!;
  return {
    campaignId: HOUSE_CAMPAIGN_ID,
    cardId: HOUSE_CARD_ID,
    cardType: "text",
    advertiser: "BackSpin",
    title: v.title,
    destinationUrl: v.url,
    sponsoredLabel: "BackSpin",
    cta: v.cta,
    logoUrl: HOUSE_LOGO_URL,
  };
}

/** True when a card is the BackSpin house ad (never billed or rewarded). */
export function isHouseCard(card: Pick<RankedCard, "campaignId">): boolean {
  return card.campaignId === HOUSE_CAMPAIGN_ID;
}
