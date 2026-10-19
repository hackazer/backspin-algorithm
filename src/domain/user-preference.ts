export interface CategorySentiment {
    useful: number;
    annoying: number;
    saved: number;
}
export declare const NEUTRAL_USER_PREFERENCE: number;
export declare const MIN_USER_PREFERENCE: number;
export declare const MAX_USER_PREFERENCE: number;
declare const PREFERENCE_SMOOTHING: number;
export function userPreferenceFactor(sentiment: CategorySentiment): number {
    const positive = Math.max(0, sentiment.useful) + Math.max(0, sentiment.saved);
    const negative = Math.max(0, sentiment.annoying);
    const evidence = positive + negative;
    if (evidence === 0)
        return NEUTRAL_USER_PREFERENCE;
    const net = (positive - negative) / (evidence + PREFERENCE_SMOOTHING);
    const halfWidth = Math.min(MAX_USER_PREFERENCE - NEUTRAL_USER_PREFERENCE, NEUTRAL_USER_PREFERENCE - MIN_USER_PREFERENCE);
    const factor = NEUTRAL_USER_PREFERENCE + net * halfWidth;
    return Math.max(MIN_USER_PREFERENCE, Math.min(MAX_USER_PREFERENCE, factor));
}
