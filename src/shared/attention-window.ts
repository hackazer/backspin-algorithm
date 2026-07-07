/**
 * Attention Window Protocol - the architectural backbone of BackSpin.
 *
 * One internal contract everything hangs off:
 *
 *   Producer (detector / SDK) --emits--> Attention Window --read by-->
 *     Scoring -> Billing -> Ledger -> Rewards
 *
 * Producers (VS Code extension, CLI wrapper, OpenCode plugin, official SDK)
 * all emit identical windows. Detection brittleness is quarantined at the
 * producer edge, so a detector can be fixed or swapped without touching
 * scoring, billing, or ledger.
 *
 * Privacy: windows carry attention metadata only (focus bool, activity
 * counts, durations). Never source code, file contents, prompts, or repo
 * names.
 */

/**
 * Context describing where an attention window is occurring. This is the
 * same shape a producer emits and the SDK north-star accepts.
 */
export interface WindowContext {
  /** Surface family the window runs on, e.g. "vscode", "cli", "opencode", "browser", "desktop". */
  platform: string;
  /** Concrete editor or host, e.g. "cursor", "windsurf", "claude-code", "codex". */
  editor: string;
  /** Detected AI workflow, e.g. "agent_generation", "thinking", "editing", "analyzing". */
  workflow: string;
  /** Primary language of the active session, e.g. "typescript". */
  language: string;
  /** Producer estimate of how long the wait will last, in seconds. */
  estimatedWaitSeconds: number;
  /**
   * Build string of the producer that emitted the window (e.g. the CLI or
   * extension version). Optional and metadata-only: lets ops correlate a
   * detection regression to a producer release.
   */
  producerVersion?: string;
  /**
   * Coarse build string of the host the producer runs in. Policy is SMALLEST
   * FINGERPRINTING: a low-cardinality bucket (e.g. "Chrome 126 · macOS ·
   * desktop" for the browser, the editor/CLI version elsewhere), never a raw
   * user-agent. Carries the few dimensions where detection bugs cluster
   * (engine+major, OS family, form factor) and drops the high-entropy tail
   * (minor/build, device model, OS version, locale).
   */
  hostVersion?: string;
  /**
   * STICKY inventory marker. A sticky window is one shown by the time-rotated
   * "sticky ad slot" (a second inventory type) rather than in response to a
   * single detected AI wait. It flows through the EXACT SAME auction, scoring,
   * and CPAS charge as a normal window, so the advertiser pays the same; the
   * ONE difference is server-side: a sticky window's PUBLISHER reward is scaled
   * by the admin-configured `stickyPublisherShareBps` (default half), because a
   * time-rotated impression is lower-trust than verified wait attention. Never
   * trusted for anything but this reward scaling, so a forged flag can only
   * REDUCE the payout, never inflate it. Optional and defaults to false.
   */
  sticky?: boolean;
}

/**
 * A single focus/activity sample taken during a window. Ticks are appended
 * while the window is open and summarized for scoring after `end`.
 */
export interface Tick {
  /** Epoch milliseconds when the sample was taken. */
  timestamp: number;
  /** Whether the host surface was focused at sample time. */
  focused: boolean;
  /** Count of keyboard activity signals observed since the previous tick. */
  keyboardActivity: number;
  /** Count of mouse activity signals observed since the previous tick. */
  mouseActivity: number;
  /**
   * Whether the discovery card was actually on screen at sample time. Distinct
   * from `focused`: the host can be focused while the card panel is collapsed,
   * the terminal line is cleared, or the browser card is scrolled out of view.
   * Optional: when a producer cannot measure it, scoring falls back to focus +
   * duration exactly as before, so existing producers are unaffected.
   */
  cardVisible?: boolean;
}

/**
 * Lifecycle status of an attention window.
 *
 * - "open"   -> window started, still accepting ticks.
 * - "ended"  -> window closed by the producer, no more ticks accepted.
 * - "scored" -> scoring ran server-side after `end`.
 *
 * Invariant: scoring happens after `end`, never mid-generation.
 */
export type WindowStatus = "open" | "ended" | "scored";

/**
 * A closed-or-open attention window. Append-only: `ticks` only grows while
 * `status` is "open". Maps 1:1 to a row in `attention_events`.
 *
 * Single-card invariant (enforced by the protocol state machine): at most
 * one active discovery card per window. No stacking, and no repeat from the
 * same advertiser within a session.
 */
export interface AttentionWindow {
  /** Stable identifier; settlement and ledger entries are keyed by this. */
  id: string;
  /** Where the window is occurring. */
  context: WindowContext;
  /** Epoch milliseconds when the window opened. */
  start: number;
  /** Focus/activity samples, appended while open. */
  ticks: Tick[];
  /** Epoch milliseconds when the window closed; undefined while "open". */
  end?: number;
  /** Lifecycle status. */
  status: WindowStatus;
}

/**
 * Options accepted when opening a window. Mirrors the SDK north-star call
 * `backspin.startAttentionWindow({ ... })`.
 */
export type StartAttentionWindowOptions = WindowContext;

/**
 * Producer interface - the north-star SDK shape every producer conforms to.
 *
 * Append-only and non-blocking by contract: recording ticks and ending a
 * window must never block or slow the AI workflow. Scoring and fraud checks
 * run async server-side after the window ends.
 *
 * Single-card invariant: a producer renders at most one active card per
 * window, and never repeats the same advertiser within a session.
 */
export interface Producer {
  /**
   * Open a new attention window for the given context.
   * Returns the freshly created window with `status` set to "open".
   */
  startAttentionWindow(options: StartAttentionWindowOptions): AttentionWindow;

  /**
   * Append a focus/activity sample to an open window.
   * No-op semantics once the window is no longer "open".
   */
  recordTick(windowId: string, tick: Tick): void;

  /**
   * Close an open window. After this the window is "ended" and accepts no
   * more ticks. Scoring runs later, server-side; the window is never scored
   * mid-generation.
   */
  endAttentionWindow(windowId: string, end: number): AttentionWindow;
}
