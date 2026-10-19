export const RELEASE_VERSION = "0.1.167";
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = pa[i] ?? 0;
        const nb = pb[i] ?? 0;
        if (na < nb)
            return -1;
        if (na > nb)
            return 1;
    }
    return 0;
}
function parseVersion(v: string): number[] {
    if (typeof v !== "string" || !v.trim())
        return [0];
    return v
        .trim()
        .split(".")
        .map((seg) => {
        const n = Number.parseInt(seg, 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}
export function isProducerOutdated(producerVersion: string | undefined, release: string = RELEASE_VERSION): boolean {
    if (!producerVersion || !producerVersion.trim())
        return false;
    return compareVersions(producerVersion, release) < 0;
}
export interface UpdateNotice {
    message: string;
    url: string;
    latestVersion: string;
}
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
export function buildUpdateNotice(producerVersion: string | undefined, platform: string | undefined, release: string = RELEASE_VERSION): UpdateNotice | null {
    if (!isProducerOutdated(producerVersion, release))
        return null;
    return {
        message: `Please update BackSpin to ${release} for the latest cards and fixes`,
        url: updateUrlForPlatform(platform),
        latestVersion: release,
    };
}
