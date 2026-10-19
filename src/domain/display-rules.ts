import type { DiscoverySupports } from "../shared/index.js";
export declare const MIN_DISCOVERY_WAIT_SECONDS: number;
export declare const IMAGE_TIER_WAIT_SECONDS: number;
export declare const CAROUSEL_TIER_WAIT_SECONDS: number;
export declare const PREMIUM_TIER_WAIT_SECONDS: number;
export function formatsForWait(estimatedWaitSeconds: number): DiscoverySupports {
    if (estimatedWaitSeconds < MIN_DISCOVERY_WAIT_SECONDS) {
        return { text: false, image: false, gif: false, carousel: false };
    }
    const text = true;
    const image = estimatedWaitSeconds >= IMAGE_TIER_WAIT_SECONDS;
    const gif = estimatedWaitSeconds >= IMAGE_TIER_WAIT_SECONDS;
    const carousel = estimatedWaitSeconds >= CAROUSEL_TIER_WAIT_SECONDS;
    return { text, image, gif, carousel };
}
export function effectiveSupports(estimatedWaitSeconds: number, surface: DiscoverySupports): DiscoverySupports {
    const wait = formatsForWait(estimatedWaitSeconds);
    return {
        text: wait.text && surface.text,
        image: wait.image && surface.image,
        gif: wait.gif && surface.gif,
        carousel: wait.carousel && surface.carousel,
    };
}
