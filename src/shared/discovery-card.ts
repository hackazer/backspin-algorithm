export type CardType = "text" | "image" | "gif" | "carousel" | "mini-demo";
export type CardCategory = string;
export const SEEDED_CARD_CATEGORIES = [
    "sponsored-tool",
    "sponsored-mcp",
    "sponsored-extension",
    "sponsored-grant",
    "sponsored-job",
    "sponsored-bounty",
] as const;
export interface DiscoveryCard {
    cardType: CardType;
    advertiserName: string;
    title: string;
    destinationUrl: string;
    sponsoredLabel: string;
    logoUrl?: string;
    imageUrl?: string;
    gifUrl?: string;
    cta?: string;
}
export interface DiscoverySupports {
    text: boolean;
    image: boolean;
    gif: boolean;
    carousel: boolean;
}
export interface DiscoveryRequest {
    userId: string;
    sessionId: string;
    platform: string;
    editor: string;
    workflow: string;
    language: string;
    estimatedWaitSeconds: number;
    attentionScore: number;
    trustRank: number;
    supports: DiscoverySupports;
}
export interface DiscoveryReward {
    type: string;
    amount: number;
}
export interface DiscoveryResponse {
    campaignId: string;
    cardType: CardType;
    advertiser: string;
    title: string;
    logoUrl?: string;
    imageUrl?: string;
    gifUrl?: string;
    cta?: string;
    destinationUrl: string;
    reward: DiscoveryReward;
}
