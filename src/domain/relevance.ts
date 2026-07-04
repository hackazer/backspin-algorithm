/**
 * Domain: relevance, the workflow-fit multiplier in CampaignScore.
 *
 * relevance is one factor of the published ranking formula:
 *
 *   CampaignScore = bid_weight x relevance x attention_quality
 *                 x user_preference x advertiser_reputation x fairness_factor
 *
 * It answers "does this campaign fit what the developer is doing right now?".
 * The wait's workflow (agent_generation, editing, analyzing, thinking, ...) is
 * matched against the campaign's discovery category via a built-in affinity
 * map: an MCP tool is most relevant while an agent is generating, an editor
 * extension while editing, and so on. There are NO advertiser-declared
 * targeting fields — relevance is derived purely from the category the
 * advertiser already chose and the live wait context, so an advertiser cannot
 * game it and there is nothing extra to police.
 *
 * Pure function, zero I/O. Bounded to a narrow band so workflow fit tilts the
 * ranking without letting it dominate bid, quality, or reputation. An unknown
 * category or workflow scores exactly neutral (1.0), so a new surface or
 * category is never penalized for being unmapped.
 */

/** Neutral multiplier: a category/workflow pair with no known affinity. */
export const NEUTRAL_RELEVANCE = 1;
/** Band edges, so workflow fit nudges ranking without dominating it. */
export const MIN_RELEVANCE = 0.6;
export const MAX_RELEVANCE = 1.4;

/**
 * Affinity of a discovery category to a wait workflow. Keyed by category, then
 * by workflow. Any pair not listed is neutral (1.0). Tuned so a strong fit
 * (>1) lifts a campaign and a poor fit (<1) discounts it, within the band.
 *
 * Categories mirror create-campaign's ALLOWED_CATEGORIES; workflows mirror the
 * WindowContext examples. Career-ish categories (grant/job/bounty) sit near
 * neutral because they are not tied to a specific coding workflow. Category
 * slugs are admin-managed (campaign_categories table); unknown slugs fall back
 * to neutral (1.0) affinity.
 */
const CATEGORY_WORKFLOW_AFFINITY: Record<string, Record<string, number>> = {
  "sponsored-mcp": {
    agent_generation: 1.4,
    analyzing: 1.2,
    thinking: 1.1,
    editing: 0.9,
  },
  "sponsored-tool": {
    agent_generation: 1.2,
    editing: 1.3,
    analyzing: 1.1,
    thinking: 0.9,
  },
  "sponsored-extension": {
    editing: 1.3,
    agent_generation: 1.1,
    thinking: 0.9,
  },
  "sponsored-grant": {
    thinking: 1.1,
  },
  "sponsored-job": {
    thinking: 1.1,
  },
  "sponsored-bounty": {
    agent_generation: 1.1,
    editing: 1.1,
  },
};

/**
 * Compute the relevance multiplier for a (category, workflow) pair. Looks up
 * the built-in affinity, defaulting to neutral for any unmapped pair, and
 * clamps to the band. Pure: depends only on its inputs.
 */
export function relevanceFactor(category: string, workflow: string): number {
  const factor =
    CATEGORY_WORKFLOW_AFFINITY[category]?.[workflow] ?? NEUTRAL_RELEVANCE;
  return Math.max(MIN_RELEVANCE, Math.min(MAX_RELEVANCE, factor));
}
