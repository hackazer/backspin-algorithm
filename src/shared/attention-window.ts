export interface WindowContext {
    platform: string;
    editor: string;
    workflow: string;
    language: string;
    estimatedWaitSeconds: number;
    producerVersion?: string;
    hostVersion?: string;
    sticky?: boolean;
}
export interface Tick {
    timestamp: number;
    focused: boolean;
    keyboardActivity: number;
    mouseActivity: number;
    cardVisible?: boolean;
}
export type WindowStatus = "open" | "ended" | "scored";
export interface AttentionWindow {
    id: string;
    context: WindowContext;
    start: number;
    ticks: Tick[];
    end?: number;
    status: WindowStatus;
}
export type StartAttentionWindowOptions = WindowContext;
export interface Producer {
    startAttentionWindow(options: StartAttentionWindowOptions): AttentionWindow;
    recordTick(windowId: string, tick: Tick): void;
    endAttentionWindow(windowId: string, end: number): AttentionWindow;
}
