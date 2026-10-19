import type { AttentionWindow } from "../shared/index.js";
import type { WindowSummary } from "./scoring.js";
export declare const FRAUD_REJECT_THRESHOLD: number;
export function computeFraudRisk(_window: AttentionWindow, _summary: WindowSummary, _serverNow?: number): number {
    return 0;
}
