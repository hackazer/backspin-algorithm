export declare const USD_PER_CREDIT: number;
export const AMBIENT_WORKFLOW = "browsing";
export declare const NORMAL_PRODUCER_REWARD_BPS: number;
export declare const BROWSER_AI_REWARD_BPS: number;
export declare const BROWSER_BROWSE_REWARD_BPS: number;
export declare const DEFAULT_USER_SHARE: number;
export declare const DEFAULT_PARTNER_SHARE: number;
export declare const DEFAULT_BACKSPIN_SHARE: number;
export declare const DEFAULT_USER_SHARE_PCT: number;
export declare const DEFAULT_PARTNER_SHARE_PCT: number;
export declare const DEFAULT_BACKSPIN_SHARE_PCT: number;
export function creditsToUsd(credits: number): number {
    if (!Number.isFinite(credits) || credits <= 0)
        return 0;
    return credits * USD_PER_CREDIT;
}
export function usdToCredits(usd: number): number {
    if (!Number.isFinite(usd) || usd <= 0)
        return 0;
    return usd / USD_PER_CREDIT;
}
export function formatUsd(usd: number, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.max(2, maximumFractionDigits),
    }).format(usd);
}
export function creditsWithUsd(credits: number, opts: {
    withUnit?: boolean;
} = {}): string {
    const { withUnit = true } = opts;
    const amount = credits.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const usd = formatUsd(creditsToUsd(credits));
    return withUnit ? `${amount} credits = ${usd}` : `${amount} = ${usd}`;
}
export interface PayoutFees {
    publisherFeeBps: number;
    withdrawalFeeBps: number;
    withdrawalFeeMinCents: number;
    withdrawalFeeFlatCents: number;
}
export interface PayoutBreakdown {
    grossUsd: number;
    publisherFeeUsd: number;
    withdrawalPctFeeUsd: number;
    withdrawalMinApplied: boolean;
    withdrawalFlatFeeUsd: number;
    totalFeesUsd: number;
    netUsd: number;
}
function roundCents(usd: number): number {
    return Math.round(usd * 100) / 100;
}
export function computePayout(credits: number, fees: PayoutFees): PayoutBreakdown {
    const grossUsd = roundCents(creditsToUsd(credits));
    const publisherFeeUsd = roundCents(grossUsd * (fees.publisherFeeBps / 10000));
    const afterPublisher = grossUsd - publisherFeeUsd;
    const rawPctUsd = roundCents(afterPublisher * (fees.withdrawalFeeBps / 10000));
    const minUsd = roundCents(Math.max(0, fees.withdrawalFeeMinCents) / 100);
    const withdrawalMinApplied = fees.withdrawalFeeBps > 0 && minUsd > rawPctUsd;
    const withdrawalPctFeeUsd = fees.withdrawalFeeBps > 0 ? Math.max(rawPctUsd, minUsd) : rawPctUsd;
    const withdrawalFlatFeeUsd = roundCents(fees.withdrawalFeeFlatCents / 100);
    const totalFeesUsd = roundCents(publisherFeeUsd + withdrawalPctFeeUsd + withdrawalFlatFeeUsd);
    const netUsd = Math.max(0, roundCents(grossUsd - totalFeesUsd));
    return {
        grossUsd,
        publisherFeeUsd,
        withdrawalPctFeeUsd,
        withdrawalMinApplied,
        withdrawalFlatFeeUsd,
        totalFeesUsd,
        netUsd,
    };
}
