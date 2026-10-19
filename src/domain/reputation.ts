export type Rating = "useful" | "neutral" | "annoying" | "dismissed";
export const RATINGS: readonly Rating[] = ["useful", "neutral", "annoying"];
export const REACTIONS: readonly Rating[] = [
    "useful",
    "neutral",
    "annoying",
    "dismissed",
];
export interface RatingCounts {
    useful: number;
    neutral: number;
    annoying: number;
    dismissed?: number;
}
export interface AttentionQuality {
    avgQuality: number;
    sampleCount: number;
}
export declare const NEUTRAL_REPUTATION: number;
export declare const MIN_REPUTATION: number;
export declare const MAX_REPUTATION: number;
declare const RATING_SENSITIVITY: number;
declare const RATING_SMOOTHING: number;
declare const DISMISS_WEIGHT: number;
declare const ATTENTION_SENSITIVITY: number;
declare const ATTENTION_SMOOTHING: number;
export declare const NEUTRAL_ATTENTION_QUALITY: number;
export function computeReputation(counts: RatingCounts, attention: AttentionQuality = {
    avgQuality: NEUTRAL_ATTENTION_QUALITY,
    sampleCount: 0,
}): number {
    const dismissed = counts.dismissed ?? 0;
    const totalReactions = counts.useful + counts.neutral + counts.annoying + dismissed;
    let reputation = NEUTRAL_REPUTATION;
    if (totalReactions > 0) {
        const ratingNet = (counts.useful - counts.annoying - DISMISS_WEIGHT * dismissed) /
            (totalReactions + RATING_SMOOTHING);
        reputation += RATING_SENSITIVITY * ratingNet;
    }
    if (attention.sampleCount > 0) {
        const confidence = attention.sampleCount / (attention.sampleCount + ATTENTION_SMOOTHING);
        const qualityNet = (attention.avgQuality - NEUTRAL_ATTENTION_QUALITY) * confidence;
        reputation += ATTENTION_SENSITIVITY * qualityNet;
    }
    return Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, reputation));
}
export function isRating(value: string): value is Rating {
    return (RATINGS as readonly string[]).includes(value);
}
export function isReaction(value: string): value is Rating {
    return (REACTIONS as readonly string[]).includes(value);
}
