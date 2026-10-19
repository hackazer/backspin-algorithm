import { MIN_CPAS as SHARED_MIN_CPAS, SUPPLY_REFERENCE as SHARED_SUPPLY_REFERENCE, ABUNDANT_DISCOUNT as SHARED_ABUNDANT_DISCOUNT, } from "../shared/index.js";
export const MIN_CPAS = SHARED_MIN_CPAS;
export const SUPPLY_REFERENCE = SHARED_SUPPLY_REFERENCE;
export const ABUNDANT_DISCOUNT = SHARED_ABUNDANT_DISCOUNT;
export interface MarketConditions {
    weightedSupply: number;
    activeCampaigns: number;
    totalBidWeight: number;
    maxBidWeight: number;
}
export function marketPriceCpas(conditions: MarketConditions): number {
    const { weightedSupply, activeCampaigns, totalBidWeight, maxBidWeight } = conditions;
    if (activeCampaigns <= 0)
        return MIN_CPAS;
    const avgBid = totalBidWeight > 0 ? totalBidWeight / activeCampaigns : MIN_CPAS;
    const ceiling = Math.max(MIN_CPAS, avgBid, maxBidWeight);
    const floor = Math.min(ceiling, Math.max(MIN_CPAS, avgBid * ABUNDANT_DISCOUNT));
    const scarcity = SUPPLY_REFERENCE / (SUPPLY_REFERENCE + Math.max(0, weightedSupply));
    const price = floor + scarcity * (ceiling - floor);
    return round2(Math.max(MIN_CPAS, Math.min(ceiling, price)));
}
function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
