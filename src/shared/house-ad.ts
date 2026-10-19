import type { RankedCard } from "./cache.js";
import type { UpdateNotice } from "./version.js";
export type NonEarningReason = "render_failed" | "below_min_wait" | "below_min_score" | "not_focused" | "no_activity" | "fraud_blocked" | "account_blocked" | "frequency_cap" | "velocity_cap" | "card_not_verified" | "unclaimed_cap";
export const NON_EARNING_REASON_TEXT: Record<NonEarningReason, string> = {
    render_failed: "the card could not be shown, so nothing was billed",
    below_min_wait: "the wait was too short to earn",
    below_min_score: "the attention score was below the minimum",
    not_focused: "the editor was not focused during the wait",
    no_activity: "no activity was detected during the wait",
    fraud_blocked: "this wait could not be counted, so it was skipped",
    account_blocked: "this account is under review",
    frequency_cap: "you have reached the reward cap for now",
    velocity_cap: "too many waits in a short time; slowing down to keep it fair",
    card_not_verified: "the card delivery could not be verified",
    unclaimed_cap: "claim your account with your email to keep earning",
};
export function nonEarningReasonText(reason: NonEarningReason | undefined): string {
    if (!reason)
        return "this wait earned no reward";
    return NON_EARNING_REASON_TEXT[reason] ?? "this wait earned no reward";
}
export const NON_EARNING_NOTICE_SHORT: Record<NonEarningReason, string> = {
    account_blocked: "account under review",
    frequency_cap: "daily reward cap reached, resets tomorrow",
    velocity_cap: "slowing down to keep it fair",
    card_not_verified: "",
    unclaimed_cap: "claim your account to keep earning",
    fraud_blocked: "",
    render_failed: "",
    below_min_wait: "",
    below_min_score: "",
    not_focused: "",
    no_activity: "",
};
export function nonEarningNoticeShort(reason: NonEarningReason | undefined): string {
    if (!isNoticeworthyReason(reason))
        return "";
    return NON_EARNING_NOTICE_SHORT[reason] ?? "";
}
export const NOTICEWORTHY_REASONS: ReadonlySet<NonEarningReason> = new Set<NonEarningReason>([
    "account_blocked",
    "frequency_cap",
    "velocity_cap",
    "unclaimed_cap",
]);
export function isNoticeworthyReason(reason: NonEarningReason | undefined): reason is NonEarningReason {
    return reason !== undefined && NOTICEWORTHY_REASONS.has(reason);
}
export interface NonEarningNotice {
    reason: NonEarningReason;
    title: string;
    body: string;
    actionable: boolean;
}
const NOTICE_TITLES: Record<NonEarningReason, string> = {
    account_blocked: "Earning paused: account under review",
    frequency_cap: "Daily reward cap reached, resets tomorrow",
    velocity_cap: "Slowing down to keep it fair",
    unclaimed_cap: "Claim your account to keep earning",
    fraud_blocked: "A wait was skipped",
    card_not_verified: "Card delivery could not be verified",
    render_failed: "",
    below_min_wait: "",
    below_min_score: "",
    not_focused: "",
    no_activity: "",
};
const NOTICE_BODIES: Record<NonEarningReason, string> = {
    account_blocked: "Your account is under anti-farm review, so waits are shown but earn nothing right now. If this looks wrong, contact support from your BackSpin dashboard.",
    frequency_cap: "You've hit today's reward cap. Discovery cards keep showing, and earning resumes automatically at the start of the next day, when your daily quota resets.",
    velocity_cap: "A lot of waits arrived in a short span, so earning is briefly throttled to keep things fair. It resumes on its own shortly.",
    unclaimed_cap: "This unclaimed account reached its pre-claim earning ceiling. Claim it with your email at usebackspin.com to lift the cap and keep your rewards.",
    fraud_blocked: "That wait could not be counted, so it was skipped and earned nothing. The most common cause is harmless: two editors recording the same wait, a retry, or a clock adjustment. The next clean wait earns normally.",
    card_not_verified: "This paid card was not accompanied by a valid server delivery proof, so the wait was recorded without billing or reward.",
    render_failed: "",
    below_min_wait: "",
    below_min_score: "",
    not_focused: "",
    no_activity: "",
};
export function nonEarningNotice(reason: NonEarningReason | undefined): NonEarningNotice | null {
    if (!isNoticeworthyReason(reason))
        return null;
    return {
        reason,
        title: NOTICE_TITLES[reason],
        body: NOTICE_BODIES[reason],
        actionable: reason === "unclaimed_cap",
    };
}
export const HOUSE_CAMPAIGN_ID = "backspin-house";
export const HOUSE_CARD_ID = "backspin-house-card";
export const HOUSE_LOGO_URL = resolveHouseLogoUrl();
function resolveHouseLogoUrl(): string {
    const env = (globalThis as {
        process?: {
            env?: Record<string, string | undefined>;
        };
    })
        .process?.env;
    return env?.BACKSPIN_LOGO_URL || "https://usebackspin.com/icon-192.png";
}
export const HOUSE_AD_VARIANTS: ReadonlyArray<{
    title: string;
    cta: string;
    url: string;
}> = [
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
export function producerUpgradeCard(): RankedCard {
    return {
        campaignId: HOUSE_CAMPAIGN_ID,
        cardId: HOUSE_CARD_ID,
        cardType: "text",
        advertiser: "BackSpin",
        title: "Update BackSpin to keep earning",
        destinationUrl: "https://usebackspin.com/extension",
        sponsoredLabel: "BackSpin",
        cta: "Update BackSpin",
        logoUrl: HOUSE_LOGO_URL,
    };
}
export function isHouseCard(card: Pick<RankedCard, "campaignId">): boolean {
    return card.campaignId === HOUSE_CAMPAIGN_ID;
}
export declare const UPDATE_NOTICE_INTERVAL_MS: number;
export function updateNoticeCard(notice: UpdateNotice): RankedCard {
    return {
        campaignId: HOUSE_CAMPAIGN_ID,
        cardId: HOUSE_CARD_ID,
        cardType: "text",
        advertiser: "BackSpin",
        title: notice.message,
        destinationUrl: notice.url,
        sponsoredLabel: "BackSpin",
        cta: "Update BackSpin",
        logoUrl: HOUSE_LOGO_URL,
    };
}
export function shouldShowUpdateNotice(notice: UpdateNotice | undefined, lastShownAtMs: number | undefined, now: number = Date.now()): boolean {
    if (!notice)
        return false;
    if (!lastShownAtMs)
        return true;
    return now - lastShownAtMs >= UPDATE_NOTICE_INTERVAL_MS;
}
