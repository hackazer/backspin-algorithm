/**
 * Stale-while-revalidate (SWR) card-delivery contracts.
 *
 * The producer prefetches a ranked batch, caches it locally, and renders
 * instantly from cache when a wait hits. It periodically checks a cheap
 * rank-version token; if the token changed (new bid, TrustRank shift,
 * reallocation) it refetches the batch for the NEXT wait. The currently
 * displayed card is never swapped mid-display.
 *
 * Both the CLI wrapper and the VS Code extension implement this identical
 * cache contract, so the shapes live here in the shared layer.
 */

import type { CardType } from "./discovery-card.js";

/**
 * A single ranked card inside a prefetched batch.
 *
 * Structured data only (no markup). `campaignId` is carried so the producer
 * can attribute an impression to the correct campaign when the card is shown.
 * Reward is NOT included here: reward is determined server-side when a closed
 * attention window is ingested and scored, never at prefetch time.
 */
export interface RankedCard {
  /** Campaign that owns this card, used for impression attribution. */
  campaignId: string;
  /**
   * The discovery card's own id. The producer sends this back as `shownCardId`
   * when ingesting the window, so the server can record an impression (which
   * rating and saving a card both attribute against).
   */
  cardId: string;
  /** Render format for this card. */
  cardType: CardType;
  /** Display name of the advertiser, e.g. "Railway". */
  advertiser: string;
  /** Card headline, plain text. The single ad line shown in the wait state. */
  title: string;
  /** https-only destination, opened in an external browser. */
  destinationUrl: string;
  /** Disclosure label shown on the card, e.g. "Sponsored". */
  sponsoredLabel: string;
  /** Optional logo asset URL (BackSpin-hosted or proxied). */
  logoUrl?: string;
  /** Optional image asset URL (BackSpin-hosted or proxied). */
  imageUrl?: string;
  /** Optional GIF asset URL (BackSpin-hosted or proxied). */
  gifUrl?: string;
  /** Optional call-to-action label, e.g. "Save for later". */
  cta?: string;
}

/**
 * Response body for `POST /api/discovery`.
 *
 * A ranked batch the producer caches locally, plus the rank-version token and
 * the cache TTL in seconds. Graceful no-fill: when nothing is eligible the
 * server returns an empty `cards` array, never a placeholder.
 */
export interface DiscoveryBatchResponse {
  /** Ranked, renderable cards (default top 6 eligible). */
  cards: RankedCard[];
  /** Opaque token that changes whenever ranking changes. */
  rankVersion: string;
  /** How long the batch may be served from cache before revalidation, seconds. */
  ttlSeconds: number;
  /**
   * Max seconds one campaign holds a producer slot before rotating to the next
   * ranked card (admin-set via reward_config). Optional for back-compat with
   * older servers; producers fall back to a built-in default when absent.
   */
  rotationWindowSeconds?: number;
  /**
   * Sticky ad slot config (admin-set via reward_config), carried on the batch
   * so a producer that supports the sticky slot knows whether to run it and how
   * often to rotate WITHOUT a second round-trip. `stickyEnabled` is the master
   * switch (a producer runs the slot only when true); `stickyRotationSeconds` is
   * how long each card holds before rotating. Both optional for back-compat with
   * older servers; a producer treats absence as "sticky off". The publisher
   * share is intentionally NOT sent: it is applied server-side at ingest and the
   * producer never needs it (and must never be trusted with reward math).
   */
  stickyEnabled?: boolean;
  stickyRotationSeconds?: number;
}

/**
 * Response body for `GET /api/discovery/rank-version`.
 *
 * The cheap revalidation check. If `rankVersion` differs from the cached one,
 * the producer refetches the batch for the next wait.
 */
export interface RankVersionResponse {
  /** Current opaque ranking token. */
  rankVersion: string;
}
