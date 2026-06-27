/**
 * Shared market-board algorithm — the ONE source of truth for the public
 * attention exchange math, imported by BOTH the API (`apps/api`, which serves
 * `/api/market`) and the web app (`apps/web`, which renders the board and the
 * how-it-works page). Nothing here is duplicated per app: the server computes
 * share of voice, the clearing price, and the lead bid with these functions and
 * sends the results to the client, and the client imports the same module for
 * its cold-start fallback, so the published algorithm can never drift between
 * where it runs and where it is shown.
 *
 * It encodes the published economics (docs/economics.md, docs/core-product-logic.md):
 *   - Pricing: CPAS clearing price, a lerp from a discounted-average-bid floor
 *     to a top-bid ceiling by supply scarcity (bounded by the top bid).
 *   - Allocation: NOT highest-bid-wins. A campaign's board score is
 *     bid_weight x advertiser_reputation x fairness_factor — the CampaignScore
 *     factors that differ between rows on a neutral public board. The
 *     context-specific factors (relevance, user_preference, attention_quality)
 *     are neutral and identical per row on the public board, so they cancel in a
 *     share RATIO and are intentionally omitted here. Share of voice is each
 *     campaign's board score over the board total.
 *
 * Pure functions, zero I/O. The server passes real inputs (live reputation,
 * createdAt, weighted supply); the client passes whatever the API returned.
 */

/* ── Pricing constants (CPAS). Mirror of domain/market-price.ts. ─────────── */

/** Floor so a thin/cold market never quotes a degenerate price. */
export const MIN_CPAS = 0.5;
/** Weighted-supply level at which the market is balanced (scarcity = 0.5). */
export const SUPPLY_REFERENCE = 120_000;
/** Abundant supply discounts the price toward this fraction of the avg bid. */
export const ABUNDANT_DISCOUNT = 0.75;

/* ── Allocation constants. Mirror of domain/ranking.ts + repo + place-bid. ─ */

/** New-campaign fairness multiplier (domain/ranking.ts NEW_CAMPAIGN_BOOST). */
export const NEW_CAMPAIGN_BOOST = 1.25;
/** New-campaign window in days (discovery-repository NEW_CAMPAIGN_WINDOW_DAYS). */
export const NEW_CAMPAIGN_WINDOW_DAYS = 7;
/** Self-serve advertiser starting reputation (place-bid SELF_SERVE_REPUTATION). */
export const SELF_SERVE_REPUTATION = 0.5;
/** Advertiser reputation bounds (domain/reputation.ts). */
export const MIN_REPUTATION = 0.5;
export const NEUTRAL_REPUTATION = 1.0;
export const MAX_REPUTATION = 1.5;
/** Default nudge added to the exact lead score so a new bid actually leads. */
export const LEAD_BID_INCREMENT = 0.1;

/** The board attributes needed to rank a campaign and price the market. */
export interface BoardCampaign {
  /** The advertiser's CPAS bid weight (the `bid_weight` rank factor). */
  bidWeight: number;
  /** Advertiser reputation multiplier, [MIN_REPUTATION, MAX_REPUTATION]. */
  reputation: number;
  /** ISO creation timestamp; absent on cold-start demo data (treated as established). */
  createdAt?: string | null;
}

/** Round to cents; prices and bids are quoted to 2 decimals. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The new-campaign fairness multiplier for a board campaign: the boost when it
 * was created inside the new-campaign window, else neutral. Mirrors the
 * server's `fairnessFactor` + the repository's `isNew` derivation. A campaign
 * with no createdAt (cold-start demo data) is treated as established (neutral).
 */
export function fairnessFactor(
  campaign: BoardCampaign,
  now: number = Date.now()
): number {
  if (!campaign.createdAt) return 1;
  const ageMs = now - new Date(campaign.createdAt).getTime();
  const windowMs = NEW_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs < windowMs ? NEW_CAMPAIGN_BOOST : 1;
}

/**
 * A campaign's board score: the product of the CampaignScore factors that
 * differ between rows on a neutral public board
 * (bid_weight x advertiser_reputation x fairness_factor). The context-specific
 * factors (relevance, user_preference, attention_quality) are neutral and equal
 * per row on the public board, so they cancel in a share ratio and are omitted.
 */
export function boardScore(
  campaign: BoardCampaign,
  now: number = Date.now()
): number {
  return (
    Math.max(0, campaign.bidWeight) *
    Math.max(0, campaign.reputation) *
    fairnessFactor(campaign, now)
  );
}

/**
 * Share of voice for one campaign as a fraction [0,1] of the whole board,
 * computed from board scores so it reflects the same factors the real ranker
 * uses (including the new-campaign boost). 0 when the board has no positive
 * score to share.
 */
export function shareOfVoiceFraction(
  campaign: BoardCampaign,
  board: readonly BoardCampaign[],
  now: number = Date.now()
): number {
  const total = board.reduce((sum, c) => sum + boardScore(c, now), 0);
  if (total <= 0) return 0;
  return boardScore(campaign, now) / total;
}

/**
 * Rank the board the way the server delivers it: by board score (the
 * share-of-voice factors bid x reputation x fairness), highest first, with a
 * stable bid-weight then reputation tiebreak so equal scores keep a
 * deterministic order. Does not mutate the input.
 */
export function rankByBoardScore<T extends BoardCampaign>(
  board: readonly T[],
  now: number = Date.now()
): T[] {
  return [...board].sort((a, b) => {
    const diff = boardScore(b, now) - boardScore(a, now);
    if (diff !== 0) return diff;
    if (b.bidWeight !== a.bidWeight) return b.bidWeight - a.bidWeight;
    return b.reputation - a.reputation;
  });
}

/**
 * The clearing market price in CPAS — the lerp between a discounted-average-bid
 * floor and a top-bid ceiling by a supply scarcity factor. Bounded by the top
 * bid by construction, so the quoted price is always coherent with the real
 * bids. Identical model to domain/market-price.ts; takes the board plus the
 * current weighted attention supply.
 */
export function clearingPriceCpas(
  board: readonly BoardCampaign[],
  weightedSupply = 0
): number {
  const active = board.length;
  if (active <= 0) return MIN_CPAS;

  const totalBid = board.reduce((sum, c) => sum + Math.max(0, c.bidWeight), 0);
  const maxBid = board.reduce((max, c) => Math.max(max, c.bidWeight), 0);
  const avgBid = totalBid > 0 ? totalBid / active : MIN_CPAS;

  const ceiling = Math.max(MIN_CPAS, avgBid, maxBid);
  const floor = Math.min(ceiling, Math.max(MIN_CPAS, avgBid * ABUNDANT_DISCOUNT));
  const scarcity = SUPPLY_REFERENCE / (SUPPLY_REFERENCE + Math.max(0, weightedSupply));

  const price = floor + scarcity * (ceiling - floor);
  return round2(Math.max(MIN_CPAS, Math.min(ceiling, price)));
}

/**
 * The minimum CPAS bid a NEW advertiser must place to LEAD the board's share of
 * voice. "Leading" means the highest board score (bid x reputation x fairness),
 * NOT merely out-bidding the top raw bid — the board is explicitly not
 * highest-bid-wins. A new advertiser enters at the self-serve starting
 * reputation with the new-campaign boost, so the bid needed to top the current
 * leader's board score is leaderScore / (newReputation x boost), nudged up by
 * one increment and floored at MIN_CPAS. Null when the board is empty (any bid
 * leads).
 */
export function bidToLeadShareOfVoice(
  board: readonly BoardCampaign[],
  opts: { newReputation?: number; increment?: number; now?: number } = {}
): number | null {
  const {
    newReputation = SELF_SERVE_REPUTATION,
    increment = LEAD_BID_INCREMENT,
    now = Date.now(),
  } = opts;
  if (board.length === 0) return null;

  const leaderScore = board.reduce(
    (max, c) => Math.max(max, boardScore(c, now)),
    0
  );
  const newAdvFactor = Math.max(0, newReputation) * NEW_CAMPAIGN_BOOST;
  if (newAdvFactor <= 0) return null;

  const bid = leaderScore / newAdvFactor + increment;
  return Math.max(MIN_CPAS, round2(bid));
}

/**
 * Map an advertiser reputation ([MIN_REPUTATION, MAX_REPUTATION]) onto a 0-100
 * reputation score for display. Linear across the real bounds, so the neutral
 * 1.0 lands at 50 and the extremes hit 0 / 100 — distinct from the user
 * TrustRank gate, which is a separate signal (domain/trust.ts).
 */
export function reputationScore(reputation: number): number {
  const span = MAX_REPUTATION - MIN_REPUTATION || 1;
  const pct = ((reputation - MIN_REPUTATION) / span) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

/* ── Share-of-voice exchange aggregation ─────────────────────────────────── */

/**
 * A campaign row as the SoV exchange consumes it: the board factors plus the
 * identity fields needed to group and label the allocation. Extends the pure
 * pricing/ranking `BoardCampaign` with display identity, so the exchange view
 * runs the SAME board math as the leaderboard and the ranker.
 */
export interface ExchangeCampaign extends BoardCampaign {
  /** Stable campaign id, for keys and drill-down. */
  campaignId: string;
  /** Advertiser/brand name shown in the allocation. */
  advertiser: string;
  /** Discovery category the campaign competes in. */
  category: string;
}

/** One advertiser's slice of the exchange: its board score and share. */
export interface ExchangeAllocation {
  campaignId: string;
  advertiser: string;
  category: string;
  bidWeight: number;
  reputation: number;
  /** Board score (bid x reputation x fairness) this share derives from. */
  score: number;
  /** Share of voice as a fraction [0,1] of the whole exchange. */
  shareOfVoice: number;
}

/** A category's aggregated demand on the exchange. */
export interface ExchangeCategoryBreakdown {
  category: string;
  /** Active campaigns competing in this category. */
  campaigns: number;
  /** Summed board score of the category. */
  score: number;
  /** Category's share of the whole exchange [0,1]. */
  shareOfVoice: number;
  /** Highest single share within the category, for a concentration read. */
  topShare: number;
}

/**
 * Allocate the exchange: every campaign's board score and share of voice,
 * ranked highest-first. This is the per-campaign allocation that the SoV
 * exchange surface renders. Uses the published `boardScore`, so the allocation
 * is exactly what the ranker would seat (NOT highest-bid-wins: reputation and
 * the new-campaign boost shape it).
 */
export function allocateExchange(
  board: readonly ExchangeCampaign[],
  now: number = Date.now()
): ExchangeAllocation[] {
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

/**
 * Aggregate the exchange by discovery category: how demand (and therefore
 * share of voice) concentrates across categories. Sorted by category share,
 * highest first. `topShare` is the largest single campaign share inside the
 * category, so the surface can flag a category dominated by one advertiser.
 */
export function exchangeCategoryBreakdown(
  board: readonly ExchangeCampaign[],
  now: number = Date.now()
): ExchangeCategoryBreakdown[] {
  const total = board.reduce((sum, c) => sum + boardScore(c, now), 0);
  const byCategory = new Map<
    string,
    { campaigns: number; score: number; topScore: number }
  >();
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

/**
 * Market concentration via the Herfindahl-Hirschman Index (HHI): the sum of
 * squared shares, in [0,1]. 0 = perfectly fragmented (many equal advertisers),
 * 1 = a single advertiser holds all share. The exchange surface uses it as a
 * one-number "is this market competitive or monopolized" health read, which is
 * exactly the NOT-highest-bid-wins thesis made measurable.
 */
export function exchangeConcentration(
  board: readonly ExchangeCampaign[],
  now: number = Date.now()
): number {
  const allocations = allocateExchange(board, now);
  const hhi = allocations.reduce(
    (sum, a) => sum + a.shareOfVoice * a.shareOfVoice,
    0
  );
  return Math.round(hhi * 1000) / 1000;
}
