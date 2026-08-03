/**
 * Single source of truth for the current BackSpin producer release, plus the
 * tiny version-compare + "an update is available" helper every surface uses.
 *
 * WHY version-derived, not an admin message: every shipped package (cli,
 * vscode extension, browser extension, sdk, ...) is pinned to ONE release by
 * `release-version.test.ts`. So "is the user's producer out of date?" is just
 * `producerVersion < RELEASE_VERSION`, computed identically everywhere. No
 * external store API, no DB row, no hand-authored copy.
 */

/**
 * The current release. Kept in lockstep with every package.json by
 * `release-version.test.ts` (bump them together at release time), so the API
 * can compare a producer's reported version against it without reading its own
 * package.json at runtime.
 */
export const RELEASE_VERSION = "0.1.166";

/**
 * Compare two dotted numeric versions ("0.1.160"). Returns -1 if a < b, 0 if
 * equal, 1 if a > b. Missing/short segments count as 0 ("0.1" === "0.1.0").
 * Non-numeric or empty input is treated as the lowest possible version, so a
 * garbage producerVersion reads as "outdated" rather than crashing.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

function parseVersion(v: string): number[] {
  if (typeof v !== "string" || !v.trim()) return [0];
  return v
    .trim()
    .split(".")
    .map((seg) => {
      const n = Number.parseInt(seg, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

/**
 * True when `producerVersion` is a valid, OLDER version than the current
 * release. Absent/blank version returns false: we only nudge a producer that
 * actually reported a version and is behind, never one that simply omitted it
 * (older clients that never send it must not be spammed).
 */
export function isProducerOutdated(
  producerVersion: string | undefined,
  release: string = RELEASE_VERSION
): boolean {
  if (!producerVersion || !producerVersion.trim()) return false;
  return compareVersions(producerVersion, release) < 0;
}

/**
 * A soft "please update" nudge carried on the discovery batch when the caller's
 * producer is behind the current release. Distinct from the HARD
 * producer-upgrade path (retired attestation protocol -> `producerUpgradeCard`,
 * which BLOCKS earning): this one is advisory. The current version still earns
 * normally; the surface just rotates in a one-slot reminder.
 */
export interface UpdateNotice {
  /** Short, surface-agnostic reminder text for the ad/status slot. */
  message: string;
  /** Where to get the update, chosen per platform. */
  url: string;
  /** The release the user should move to (for surfaces that want to show it). */
  latestVersion: string;
}

/**
 * Per-surface update destination. VS Code family points at the Marketplace
 * listing (also mirrored on Open VSX); browser and CLI use the hosted
 * install/extension pages. Unknown platforms fall back to the generic page.
 */
export function updateUrlForPlatform(platform: string | undefined): string {
  switch ((platform || "").toLowerCase()) {
    case "vscode":
      return "https://marketplace.visualstudio.com/items?itemName=Backspin.backspin-vscode";
    case "browser":
      return "https://usebackspin.com/extension";
    case "cli":
    case "desktop":
    case "opencode":
      return "https://usebackspin.com/install.sh";
    default:
      return "https://usebackspin.com/extension";
  }
}

/**
 * Build the update notice for a producer on `platform` reporting
 * `producerVersion`, or null when it is current (or omitted). One helper the
 * server calls; producers only render the result.
 */
export function buildUpdateNotice(
  producerVersion: string | undefined,
  platform: string | undefined,
  release: string = RELEASE_VERSION
): UpdateNotice | null {
  if (!isProducerOutdated(producerVersion, release)) return null;
  return {
    message: `Please update BackSpin to ${release} for the latest cards and fixes`,
    url: updateUrlForPlatform(platform),
    latestVersion: release,
  };
}
