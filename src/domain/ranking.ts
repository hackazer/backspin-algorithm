/**
 * Domain: discovery ranking + allocation.
 *
 * Pure business logic, zero I/O. Delivery is NOT highest-bid-wins. Two ideas
 * from economics.md / core-product-logic.md combine here:
 *
 * 1. CampaignScore (the published, exact ranking formula):
 *
 *      CampaignScore = bid_weight x relevance x attention_quality
 *                      x user_preference x advertiser_reputation x fairness_factor
 *
 *    We compute bid_weight, attention_quality, advertiser_reputation, and now
 *    fairness_factor (the new-campaign boost) from real data, and hold
 *    relevance and user_preference at neutral constants (user_preference is
 *    also enforced as a hard mute upstream). The formula never changes.
 *
 * 2. Allocation (how the batch's slots are shared), which is an equal base
 *    floor + a purchased share-of-voice boost, shaped by category caps,
 *    diversity, and a new-campaign boost. This is deliberately NOT
 *    highest-bid-wins:
 *
 *      - Base floor + diversity: a first pass seats each advertiser's single
 *        best card (in score order) before any advertiser gets a second, so
 *        spend cannot monopolize the batch and the user sees a varied set.
 *      - Purchased boost: a second pass fills the remaining slots in score
 *        order (where bid_weight lifts score), so spend buys extra share on
 *        top of the floor, capped per advertiser and per category.
 *      - Category caps: no single category dominates a surface.
 *      - New-campaign boost: fresh campaigns get a fairness multiplier so they
 *        gather initial exposure and quality signals.
 *      - Graceful fallback: if the caps leave the batch short (a homogeneous
 *        pool), the caps relax to fill it, still in score order.
 */

import { createHash } from "node:crypto";
import type {
  CardType,
  DiscoverySupports,
  RankedCard,
} from "../shared/index.js";

/** Default number of cards returned in a discovery batch. */
export const DEFAULT_BATCH_SIZE = 6;

/** Cache TTL the producer honors before revalidating, in seconds. */
export const BATCH_TTL_SECONDS = 60;

/**
 * Default seconds a single campaign holds a producer slot (CLI status line /
 * spinner) before rotating to the next ranked campaign. Admin-overridable via
 * reward_config.rotationWindowSeconds; this is the fallback when no config repo
 * is wired (e.g. unit tests). Keeps the #1 campaign from monopolizing the slot.
 */
export const DEFAULT_ROTATION_WINDOW_SECONDS = 10;

/**
 * Share-of-voice diversity cap: at most this many cards from one advertiser in
 * a batch, so no advertiser monopolizes discovery (the "NOT highest-bid-wins"
 * thesis). Applied with graceful fallback, so a homogeneous candidate pool
 * still fills the batch.
 */
export const MAX_CARDS_PER_ADVERTISER = 2;

/**
 * Category allocation cap: at most this share of a batch may come from one
 * discovery category, so no single category dominates a surface. Scales with
 * batch size and is applied with the same graceful fallback as the advertiser
 * cap.
 */
export function maxCardsPerCategory(batchSize: number): number {
  return Math.max(1, Math.ceil(batchSize / 2));
}

/** Fairness multiplier applied to a new campaign so it gathers early exposure. */
export const NEW_CAMPAIGN_BOOST = 1.25;

/** Neutral MVP multipliers for signals the full engine will compute later. */
/** Neutral fairness multiplier for an established campaign. */
export const NEUTRAL_FAIRNESS_FACTOR = 1;
/** Neutral user_preference: a user who has not reacted to the category. */
export const NEUTRAL_USER_PREFERENCE = 1;
/** Neutral relevance: a category/workflow pair with no known affinity. */
export const NEUTRAL_RELEVANCE = 1;

/** A candidate card plus the campaign attributes needed to score it. */
export interface RankableCard {
  card: RankedCard;
  bidWeight: number;
  reputation: number;
  /** The campaign's discovery category, for user mute filtering + caps. */
  category: string;
  /**
   * Whether the campaign is new enough to receive the new-campaign fairness
   * boost. Defaults to false (an established campaign at neutral fairness).
   */
  isNew?: boolean;
  /**
   * The user_preference multiplier for this (user, category), from the user's
   * own rating/save history. Defaults to neutral (1.0) when the user has not
   * reacted to the category, so personalization only refines an earned signal.
   */
  userPreference?: number;
  /**
   * The relevance multiplier for this (category, wait workflow), from the
   * built-in affinity heuristic. Defaults to neutral (1.0) for an unmapped
   * category/workflow pair.
   */
  relevance?: number;
}

/** Whether a card's format is renderable by the requesting surface. */
export function supportsCardType(
  cardType: CardType,
  supports: DiscoverySupports
): boolean {
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
      // Mini-demo is stubbed for the MVP; treat as carousel capability.
      return supports.carousel;
    default:
      return false;
  }
}

/** The fairness multiplier for a candidate: a new-campaign boost, else neutral. */
export function fairnessFactor(candidate: RankableCard): number {
  return candidate.isNew ? NEW_CAMPAIGN_BOOST : NEUTRAL_FAIRNESS_FACTOR;
}

/**
 * Compute a campaign delivery score from the published formula.
 * attention_quality scales with the surface's locally reported AttentionScore
 * (0-100 -> 0-1). relevance is the category/workflow affinity for the wait;
 * user_preference comes from the viewer's own rating/save history;
 * fairness_factor carries the new-campaign boost.
 */
export function campaignScore(
  bidWeight: number,
  reputation: number,
  attentionScore: number,
  fairness: number = NEUTRAL_FAIRNESS_FACTOR,
  userPreference: number = NEUTRAL_USER_PREFERENCE,
  relevance: number = NEUTRAL_RELEVANCE
): number {
  const attentionQuality = Math.max(0, Math.min(100, attentionScore)) / 100;
  return (
    bidWeight *
    relevance *
    attentionQuality *
    userPreference *
    reputation *
    fairness
  );
}

/** A candidate after scoring, carrying the attributes the allocator needs. */
interface ScoredCandidate {
  card: RankedCard;
  score: number;
  advertiser: string;
  category: string;
}

/**
 * Rank renderable candidates for a context and return the allocated batch.
 *
 * Pure: the caller supplies the already-fetched candidates and the user's
 * muted categories. Steps:
 *   1. Drop muted categories (user_preference as a hard opt-out) and formats
 *      the surface cannot render.
 *   2. Score each by the published CampaignScore (with the new-campaign
 *      fairness boost), sort highest-first with a stable campaignId tiebreak.
 *   3. Base-floor + diversity pass: seat each advertiser's best card once,
 *      respecting the per-category cap, so spend cannot monopolize the batch.
 *   4. Purchased-boost pass: fill remaining slots in score order, respecting
 *      the per-advertiser and per-category caps, so spend buys extra share.
 *   5. Graceful fallback: if caps left the batch short, relax them and fill
 *      from the remaining cards in score order.
 * Empty array in, empty array out.
 */
export function rankCards(
  candidates: RankableCard[],
  supports: DiscoverySupports,
  attentionScore: number,
  mutedCategories: ReadonlySet<string> = new Set(),
  batchSize = DEFAULT_BATCH_SIZE,
  maxCardsPerAdvertiser = MAX_CARDS_PER_ADVERTISER
): RankedCard[] {
  // Single pass: drop muted categories and unsupported formats, scoring only
  // the survivors. Avoids the two intermediate arrays a filter().filter().map()
  // chain would allocate on this hot discovery-serve path.
  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    if (mutedCategories.has(c.category)) continue;
    if (!supportsCardType(c.card.cardType, supports)) continue;
    scored.push({
      card: c.card,
      score: campaignScore(
        c.bidWeight,
        c.reputation,
        attentionScore,
        fairnessFactor(c),
        c.userPreference ?? NEUTRAL_USER_PREFERENCE,
        c.relevance ?? NEUTRAL_RELEVANCE
      ),
      advertiser: c.card.advertiser,
      category: c.category,
    });
  }

  // Highest score first. Ties broken by campaignId for a stable order.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.card.campaignId.localeCompare(b.card.campaignId);
  });

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

  // Pass 1 - base floor + diversity: each advertiser's best card once, under
  // the category cap. Equal footing before spend buys a second slot.
  const seededAdvertisers = new Set<string>();
  for (const c of scored) {
    if (picked.length >= batchSize) break;
    if (seededAdvertisers.has(c.advertiser)) continue;
    if ((perCategory.get(c.category) ?? 0) >= categoryCap) continue;
    seededAdvertisers.add(c.advertiser);
    take(c);
  }

  // Pass 2 - purchased share-of-voice boost: fill remaining slots in score
  // order, capped per advertiser and per category, so spend buys extra share
  // without monopolizing.
  for (const c of scored) {
    if (picked.length >= batchSize) break;
    if (pickedSet.has(c.card)) continue;
    if ((perAdvertiser.get(c.advertiser) ?? 0) >= maxCardsPerAdvertiser) {
      continue;
    }
    if ((perCategory.get(c.category) ?? 0) >= categoryCap) continue;
    take(c);
  }

  // Pass 3 - graceful fallback: a homogeneous pool (one advertiser/category)
  // must still fill the batch, so the caps relax, still in score order.
  for (const c of scored) {
    if (picked.length >= batchSize) break;
    if (pickedSet.has(c.card)) continue;
    take(c);
  }

  return picked;
}

/**
 * Stable hash of the ranked set. Identical rankings -> identical token, so the
 * producer's revalidation check only refetches when ranking actually changed.
 */
export function computeRankVersion(cards: RankedCard[]): string {
  const basis = cards
    .map((c) => `${c.campaignId}:${c.cardType}:${c.title}`)
    .join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 16);
}
