/**
 * Discovery card schema - the structured contract for sponsored discovery.
 *
 * Cards are DATA, not markup. Advertisers submit structured fields only
 * (never HTML, never JS). The renderer composes them, so there is zero
 * injection surface. Image/GIF/logo assets are hosted by BackSpin or
 * proxied through BackSpin, never hotlinked. Destination URLs are https
 * only and open in an external browser.
 */

/**
 * Card render format. Chosen at render time by expected wait length:
 * Text (3-5s) -> Image (5-20s) -> Carousel (20s+) -> Mini-demo (30s+).
 */
export type CardType = "text" | "image" | "gif" | "carousel" | "mini-demo";

/**
 * Discovery category. Admin-managed via the campaign_categories table; the
 * seeded defaults below are kept as a convenience constant for places that
 * want to enumerate the built-in set. New admin-created slugs are valid too,
 * so the runtime type is `string`.
 */
export type CardCategory = string;

/** The categories seeded by migration 0037 (the built-in set). */
export const SEEDED_CARD_CATEGORIES = [
  "sponsored-tool",
  "sponsored-mcp",
  "sponsored-extension",
  "sponsored-grant",
  "sponsored-job",
  "sponsored-bounty",
] as const;

/**
 * A discovery card as served to a producer for rendering.
 *
 * MVP fields only. Structured data, never markup. Logo and media assets are
 * optional, so the fastest campaign path is name + message + URL (text only).
 */
export interface DiscoveryCard {
  /** Render format for this card. */
  cardType: CardType;
  /** Display name of the advertiser, e.g. "Railway". */
  advertiserName: string;
  /** Card headline, plain text. The single ad line shown in the wait state. */
  title: string;
  /** https-only destination, opened in an external browser, never the privileged context. */
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
 * Which card formats the requesting surface can render. Drives the
 * format-by-wait-length decision server-side.
 */
export interface DiscoverySupports {
  text: boolean;
  image: boolean;
  gif: boolean;
  carousel: boolean;
}

/**
 * Request body for `POST /api/discovery`.
 *
 * Carries the window context plus the locally computed attention signals so
 * the server can decide eligibility and pick a format. Matches the JSON
 * example in technical-architecture.md.
 */
export interface DiscoveryRequest {
  userId: string;
  sessionId: string;
  /** Surface family, e.g. "vscode". */
  platform: string;
  /** Concrete editor or host, e.g. "cursor". */
  editor: string;
  /** Detected workflow, e.g. "agent_generation". */
  workflow: string;
  /** Primary language, e.g. "typescript". */
  language: string;
  /** Producer estimate of the wait length, in seconds. */
  estimatedWaitSeconds: number;
  /** Locally computed AttentionScore (0-100). */
  attentionScore: number;
  /** Locally computed TrustRank (0-100). */
  trustRank: number;
  /** Formats the surface can render. */
  supports: DiscoverySupports;
}

/**
 * Reward attached to a served discovery, reported alongside the card.
 */
export interface DiscoveryReward {
  /** Reward kind, e.g. "attention_credit". */
  type: string;
  /** Reward amount in the unit implied by `type`. */
  amount: number;
}

/**
 * Response body for `POST /api/discovery`.
 *
 * A flat card payload plus campaign id and reward. Graceful no-fill: when no
 * campaign is eligible the server returns nothing renderable, never a
 * placeholder. Matches the JSON example in technical-architecture.md.
 */
export interface DiscoveryResponse {
  campaignId: string;
  cardType: CardType;
  /** Advertiser display name (the response uses `advertiser`). */
  advertiser: string;
  title: string;
  logoUrl?: string;
  imageUrl?: string;
  gifUrl?: string;
  cta?: string;
  destinationUrl: string;
  reward: DiscoveryReward;
}
