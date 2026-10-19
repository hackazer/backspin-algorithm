export declare const MIN_CPAS: number;
export declare const SUPPLY_REFERENCE: number;
export declare const ABUNDANT_DISCOUNT: number;
export declare const NEW_CAMPAIGN_BOOST: number;
export declare const NEW_CAMPAIGN_WINDOW_DAYS: number;
export declare const SELF_SERVE_REPUTATION: number;
export declare const MIN_REPUTATION: number;
export declare const NEUTRAL_REPUTATION: number;
export declare const MAX_REPUTATION: number;
export declare const LEAD_BID_INCREMENT: number;
export interface BoardCampaign {
    bidWeight: number;
    reputation: number;
    createdAt?: string | null;
}
function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
export function fairnessFactor(campaign: BoardCampaign, now: number = Date.now()): number {
    if (!campaign.createdAt)
        return 1;
    const ageMs = now - new Date(campaign.createdAt).getTime();
    const windowMs = NEW_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return ageMs >= 0 && ageMs < windowMs ? NEW_CAMPAIGN_BOOST : 1;
}
export function boardScore(campaign: BoardCampaign, now: number = Date.now()): number {
    return (Math.max(0, campaign.bidWeight) *
        Math.max(0, campaign.reputation) *
        fairnessFactor(campaign, now));
}
export function shareOfVoiceFractions(board: readonly BoardCampaign[], now: number = Date.now()): number[] {
    const scores = board.map((c) => boardScore(c, now));
    const total = scores.reduce((sum, s) => sum + s, 0);
    if (total <= 0)
        return scores.map(() => 0);
    return scores.map((s) => s / total);
}
export function shareOfVoiceFraction(campaign: BoardCampaign, board: readonly BoardCampaign[], now: number = Date.now()): number {
    const total = board.reduce((sum, c) => sum + boardScore(c, now), 0);
    if (total <= 0)
        return 0;
    return boardScore(campaign, now) / total;
}
export function rankByBoardScore<T extends BoardCampaign>(board: readonly T[], now: number = Date.now()): T[] {
    return [...board].sort((a, b) => {
        const diff = boardScore(b, now) - boardScore(a, now);
        if (diff !== 0)
            return diff;
        if (b.bidWeight !== a.bidWeight)
            return b.bidWeight - a.bidWeight;
        return b.reputation - a.reputation;
    });
}
export function clearingPriceCpas(board: readonly BoardCampaign[], weightedSupply = 0): number {
    const active = board.length;
    if (active <= 0)
        return MIN_CPAS;
    const totalBid = board.reduce((sum, c) => sum + Math.max(0, c.bidWeight), 0);
    const maxBid = board.reduce((max, c) => Math.max(max, c.bidWeight), 0);
    const avgBid = totalBid > 0 ? totalBid / active : MIN_CPAS;
    const ceiling = Math.max(MIN_CPAS, avgBid, maxBid);
    const floor = Math.min(ceiling, Math.max(MIN_CPAS, avgBid * ABUNDANT_DISCOUNT));
    const scarcity = SUPPLY_REFERENCE / (SUPPLY_REFERENCE + Math.max(0, weightedSupply));
    const price = floor + scarcity * (ceiling - floor);
    return round2(Math.max(MIN_CPAS, Math.min(ceiling, price)));
}
export function bidToLeadShareOfVoice(board: readonly BoardCampaign[], opts: {
    newReputation?: number;
    increment?: number;
    now?: number;
} = {}): number | null {
    const { newReputation = SELF_SERVE_REPUTATION, increment = LEAD_BID_INCREMENT, now = Date.now(), } = opts;
    if (board.length === 0)
        return null;
    const leaderScore = board.reduce((max, c) => Math.max(max, boardScore(c, now)), 0);
    const newAdvFactor = Math.max(0, newReputation) * NEW_CAMPAIGN_BOOST;
    if (newAdvFactor <= 0)
        return null;
    const bid = leaderScore / newAdvFactor + increment;
    return Math.max(MIN_CPAS, round2(bid));
}
export function reputationScore(reputation: number): number {
    const span = MAX_REPUTATION - MIN_REPUTATION || 1;
    const pct = ((reputation - MIN_REPUTATION) / span) * 100;
    return Math.round(Math.max(0, Math.min(100, pct)));
}
export interface ExchangeCampaign extends BoardCampaign {
    campaignId: string;
    advertiser: string;
    category: string;
}
export interface ExchangeAllocation {
    campaignId: string;
    advertiser: string;
    category: string;
    bidWeight: number;
    reputation: number;
    score: number;
    shareOfVoice: number;
}
export interface ExchangeCategoryBreakdown {
    category: string;
    campaigns: number;
    score: number;
    shareOfVoice: number;
    topShare: number;
}
export function allocateExchange(board: readonly ExchangeCampaign[], now: number = Date.now()): ExchangeAllocation[] {
    const total = board.reduce((sum, c) => sum + boardScore(c, now), 0);
    return rankByBoardScore(board, now).map((c) => {
        const score = boardScore(c, now);
        return {
            campaignId: c.campaignId,
            advertiser: c.advertiser,
            category: c.category,
            bidWeight: c.bidWeight,
            reputation: c.reputation,
            score: round2(score),
            shareOfVoice: total > 0 ? score / total : 0,
        };
    });
}
export function exchangeCategoryBreakdown(board: readonly ExchangeCampaign[], now: number = Date.now()): ExchangeCategoryBreakdown[] {
    const total = board.reduce((sum, c) => sum + boardScore(c, now), 0);
    const byCategory = new Map<string, {
        campaigns: number;
        score: number;
        topScore: number;
    }>();
    for (const c of board) {
        const score = boardScore(c, now);
        const agg = byCategory.get(c.category) ?? {
            campaigns: 0,
            score: 0,
            topScore: 0,
        };
        agg.campaigns += 1;
        agg.score += score;
        agg.topScore = Math.max(agg.topScore, score);
        byCategory.set(c.category, agg);
    }
    return [...byCategory.entries()]
        .map(([category, agg]) => ({
        category,
        campaigns: agg.campaigns,
        score: round2(agg.score),
        shareOfVoice: total > 0 ? agg.score / total : 0,
        topShare: agg.score > 0 ? agg.topScore / agg.score : 0,
    }))
        .sort((a, b) => b.shareOfVoice - a.shareOfVoice);
}
export function exchangeConcentration(board: readonly ExchangeCampaign[], now: number = Date.now()): number {
    const allocations = allocateExchange(board, now);
    const hhi = allocations.reduce((sum, a) => sum + a.shareOfVoice * a.shareOfVoice, 0);
    return Math.round(hhi * 1000) / 1000;
}
