export interface AttentionScoreInputs {
    activity: number;
    focus: number;
    session_quality: number;
    workflow_relevance: number;
    trust_score: number;
    fraud_risk: number;
}
export interface CampaignScoreInputs {
    bid_weight: number;
    relevance: number;
    attention_quality: number;
    user_preference: number;
    advertiser_reputation: number;
    fairness_factor: number;
}
export function weightedAttention(rawSeconds: number, attentionScore: number): number {
    return rawSeconds * (attentionScore / 100);
}
