export interface TrustHistory {
    priorEligibleWindows: number;
    priorTotalWindows: number;
}
export declare const NEUTRAL_TRUST: number;
export declare const MIN_TRUST: number;
export declare const MAX_TRUST: number;
declare const SMOOTHING: number;
export function computeTrustScore(history: TrustHistory): number {
    const eligible = Math.max(0, history.priorEligibleWindows);
    const total = Math.max(eligible, history.priorTotalWindows);
    const ineligible = total - eligible;
    const positive = SMOOTHING / 2 + eligible;
    const negative = SMOOTHING / 2 + ineligible;
    const trust = (MAX_TRUST * positive) / (positive + negative);
    return Math.max(MIN_TRUST, Math.min(MAX_TRUST, trust));
}
