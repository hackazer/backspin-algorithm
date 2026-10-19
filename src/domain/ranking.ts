import { createHash } from "node:crypto";
import type { CardType, DiscoverySupports, RankedCard, } from "../shared/index.js";
export declare const DEFAULT_BATCH_SIZE: number;
export declare const BATCH_TTL_SECONDS: number;
export declare const DEFAULT_ROTATION_WINDOW_SECONDS: number;
export declare const MAX_CARDS_PER_ADVERTISER: number;
export function maxCardsPerCategory(batchSize: number): number {
    return Math.max(1, Math.ceil(batchSize / 2));
}
export declare const NEW_CAMPAIGN_BOOST: number;
export declare const NEUTRAL_FAIRNESS_FACTOR: number;
export declare const NEUTRAL_USER_PREFERENCE: number;
export declare const NEUTRAL_RELEVANCE: number;
export interface RankableCard {
    card: RankedCard;
    bidWeight: number;
    reputation: number;
    category: string;
    isNew?: boolean;
    userPreference?: number;
    relevance?: number;
}
export function supportsCardType(cardType: CardType, supports: DiscoverySupports): boolean {
    switch (cardType) {
        case "text":
            return supports.text;
        case "image":
            return supports.image;
        case "gif":
            return supports.gif;
        case "carousel":
            return supports.carousel;
        case "mini-demo":
            return supports.carousel;
        default:
            return false;
    }
}
export function fairnessFactor(candidate: RankableCard): number {
    return candidate.isNew ? NEW_CAMPAIGN_BOOST : NEUTRAL_FAIRNESS_FACTOR;
}
export function campaignScore(bidWeight: number, reputation: number, attentionScore: number, fairness: number = NEUTRAL_FAIRNESS_FACTOR, userPreference: number = NEUTRAL_USER_PREFERENCE, relevance: number = NEUTRAL_RELEVANCE): number {
    const attentionQuality = Math.max(0, Math.min(100, attentionScore)) / 100;
    return (bidWeight *
        relevance *
        attentionQuality *
        userPreference *
        reputation *
        fairness);
}
interface ScoredCandidate {
    card: RankedCard;
    score: number;
    advertiser: string;
    category: string;
}
export function rankCards(candidates: RankableCard[], supports: DiscoverySupports, attentionScore: number, mutedCategories: ReadonlySet<string> = new Set(), batchSize = DEFAULT_BATCH_SIZE, maxCardsPerAdvertiser = MAX_CARDS_PER_ADVERTISER, seed?: string): RankedCard[] {
    const scored: ScoredCandidate[] = [];
    for (const c of candidates) {
        if (mutedCategories.has(c.category))
            continue;
        if (!supportsCardType(c.card.cardType, supports))
            continue;
        scored.push({
            card: c.card,
            score: campaignScore(c.bidWeight, c.reputation, attentionScore, fairnessFactor(c), c.userPreference ?? NEUTRAL_USER_PREFERENCE, c.relevance ?? NEUTRAL_RELEVANCE),
            advertiser: c.card.advertiser,
            category: c.category,
        });
    }
    scored.sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        return a.card.campaignId.localeCompare(b.card.campaignId);
    });
    if (seed !== undefined)
        drawOrder(scored, seed);
    const categoryCap = maxCardsPerCategory(batchSize);
    const perAdvertiser = new Map<string, number>();
    const perCategory = new Map<string, number>();
    const picked: RankedCard[] = [];
    const pickedSet = new Set<RankedCard>();
    const take = (c: ScoredCandidate): void => {
        perAdvertiser.set(c.advertiser, (perAdvertiser.get(c.advertiser) ?? 0) + 1);
        perCategory.set(c.category, (perCategory.get(c.category) ?? 0) + 1);
        picked.push(c.card);
        pickedSet.add(c.card);
    };
    const seededAdvertisers = new Set<string>();
    for (const c of scored) {
        if (picked.length >= batchSize)
            break;
        if (seededAdvertisers.has(c.advertiser))
            continue;
        if ((perCategory.get(c.category) ?? 0) >= categoryCap)
            continue;
        seededAdvertisers.add(c.advertiser);
        take(c);
    }
    for (const c of scored) {
        if (picked.length >= batchSize)
            break;
        if (pickedSet.has(c.card))
            continue;
        if ((perAdvertiser.get(c.advertiser) ?? 0) >= maxCardsPerAdvertiser) {
            continue;
        }
        if ((perCategory.get(c.category) ?? 0) >= categoryCap)
            continue;
        take(c);
    }
    for (const c of scored) {
        if (picked.length >= batchSize)
            break;
        if (pickedSet.has(c.card))
            continue;
        take(c);
    }
    return picked;
}
function drawOrder(scored: ScoredCandidate[], seed: string): void {
    const keys = new Map<ScoredCandidate, number>();
    for (const c of scored) {
        if (c.score <= 0) {
            keys.set(c, -1);
            continue;
        }
        const h = createHash("sha256")
            .update(`${seed}\u0000${c.card.campaignId}\u0000${c.card.cardId ?? c.card.title}`)
            .digest();
        const u = (h.readUIntBE(0, 6) + 1) / (2 ** 48 + 2);
        keys.set(c, Math.pow(u, 1 / c.score));
    }
    scored.sort((a, b) => keys.get(b)! - keys.get(a)!);
}
export function computeRankVersion(cards: RankedCard[], salt = ""): string {
    const basis = cards
        .map((c) => `${c.campaignId}:${c.cardType}:${c.title}`)
        .join("|");
    const input = salt ? `${salt}\u0000${basis}` : basis;
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
