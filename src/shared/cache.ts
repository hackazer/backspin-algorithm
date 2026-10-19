import type { CardType } from "./discovery-card.js";
import type { UpdateNotice } from "./version.js";
export interface RankedCard {
    campaignId: string;
    cardId: string;
    cardType: CardType;
    advertiser: string;
    title: string;
    destinationUrl: string;
    sponsoredLabel: string;
    logoUrl?: string;
    imageUrl?: string;
    gifUrl?: string;
    cta?: string;
    deliveryProof?: string;
}
export interface DiscoveryBatchResponse {
    cards: RankedCard[];
    rankVersion: string;
    ttlSeconds: number;
    rotationWindowSeconds?: number;
    stickyEnabled?: boolean;
    stickyRotationSeconds?: number;
    updateAvailable?: UpdateNotice;
}
export interface RankVersionResponse {
    rankVersion: string;
}
