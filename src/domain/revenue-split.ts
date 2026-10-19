import { DEFAULT_USER_SHARE, DEFAULT_PARTNER_SHARE } from "../shared/index.js";
export { DEFAULT_USER_SHARE, DEFAULT_PARTNER_SHARE };
export interface RevenueSplit {
    userShare: number;
    partnerShare: number;
}
export const DEFAULT_REVENUE_SPLIT: RevenueSplit = {
    userShare: DEFAULT_USER_SHARE,
    partnerShare: DEFAULT_PARTNER_SHARE,
};
export interface SplitResult {
    gross: number;
    user: number;
    partner: number;
    backspin: number;
}
function clampShare(share: number): number {
    return Math.max(0, Math.min(1, share));
}
export function splitRevenue(gross: number, split: RevenueSplit = DEFAULT_REVENUE_SPLIT): SplitResult {
    if (gross <= 0) {
        return { gross: 0, user: 0, partner: 0, backspin: 0 };
    }
    const userShare = clampShare(split.userShare);
    const partnerShare = Math.min(clampShare(split.partnerShare), 1 - userShare);
    const user = gross * userShare;
    const partner = gross * partnerShare;
    const backspin = gross - user - partner;
    return { gross, user, partner, backspin };
}
export function userReward(gross: number, split: RevenueSplit = DEFAULT_REVENUE_SPLIT): number {
    return splitRevenue(gross, split).user;
}
