export declare const NEUTRAL_RELEVANCE: number;
export declare const MIN_RELEVANCE: number;
export declare const MAX_RELEVANCE: number;
declare const CATEGORY_WORKFLOW_AFFINITY: Record<string, Record<string, number>>;
export function relevanceFactor(category: string, workflow: string): number {
    const factor = CATEGORY_WORKFLOW_AFFINITY[category]?.[workflow] ?? NEUTRAL_RELEVANCE;
    return Math.max(MIN_RELEVANCE, Math.min(MAX_RELEVANCE, factor));
}
