/**
 * Sync the public algorithm mirror from the monorepo source of truth.
 *
 * The monorepo (apps/api/src/domain + packages/shared/src) is the ONLY source
 * of truth. This script regenerates open-algorithm/src from it so the public
 * mirror can never silently drift from the live code:
 *
 *   - The published domain formulas are copied VERBATIM.
 *   - fraud.ts is replaced by the documented public stub (stubs/fraud.ts).
 *   - Closed anti-abuse infra (farm/origin-hash/attribution-token) is excluded;
 *     nothing in the published set imports it.
 *   - The shared formula types are copied so the package is standalone, and the
 *     domain's "@usebackspin/shared" imports are rewritten to a local path.
 *
 * Run from the monorepo root: `node open-algorithm/scripts/sync.mjs`
 * Then commit + push open-algorithm/ to its own public repo (see README).
 */
import { cp, mkdir, readFile, writeFile, rm, readdir, mkdtemp } from "node:fs/promises";
import { dirname, resolve, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

/**
 * `--check` mode: regenerate the mirror into a TEMP dir and diff it against the
 * committed open-algorithm/src (which is tracked by the nested public repo). It
 * writes nothing to src and exits non-zero if they differ, so CI can FAIL when
 * the published mirror has drifted from the monorepo source — turning the
 * README's "cannot drift" promise from a claim into an enforced invariant.
 * Normal mode (no flag) regenerates src in place as before.
 */
const CHECK = process.argv.includes("--check");

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");                 // open-algorithm/
const root = resolve(pkg, "..");                 // monorepo root
const domainSrc = resolve(root, "apps/api/src/domain");
const sharedSrc = resolve(root, "packages/shared/src");

/** Domain files published verbatim (the real, production formulas). */
const PUBLISHED_DOMAIN = [
  "scoring.ts",
  "ranking.ts",
  "relevance.ts",
  "reputation.ts",
  "revenue-split.ts",
  "market-price.ts",
  "display-rules.ts",
  "user-preference.ts",
  "trust.ts",
];

/** Domain files replaced by a public stub (compile-required, logic private). */
const STUBBED_DOMAIN = { "fraud.ts": resolve(pkg, "stubs/fraud.ts") };

/**
 * Closed anti-abuse infra, intentionally NOT published. Listed only as a guard:
 * if any published file ever imports one of these, the sync fails loudly rather
 * than leaking it.
 */
const EXCLUDED_DOMAIN = ["farm.ts", "origin-hash.ts", "attribution-token.ts"];

/** Shared formula sources the published domain imports (standalone bundle). */
const PUBLISHED_SHARED = ["attention-window.ts", "scoring.ts", "economics.ts", "discovery-card.ts", "cache.ts", "market-board.ts", "house-ad.ts"];

/** Rewrite a monorepo "@usebackspin/shared" import to the local shared bundle. */
function rewriteSharedImport(code, fromDir) {
  // From src/domain/*.ts the shared bundle sits at ../shared/index.js.
  return code.replace(/from\s+"@usebackspin\/shared"/g, 'from "../shared/index.js"');
}

async function main() {
  // In --check mode generate into a throwaway temp dir; else regenerate src.
  const srcDir = resolve(pkg, "src");
  const base = CHECK ? await mkdtemp(join(tmpdir(), "backspin-algo-")) : srcDir;
  const outDomain = join(base, "domain");
  const outShared = join(base, "shared");
  // Clean slate so a removed file upstream disappears here too.
  await rm(base, { recursive: true, force: true });
  await mkdir(outDomain, { recursive: true });
  await mkdir(outShared, { recursive: true });

  // 1. Shared formula types (standalone), with a local index.
  for (const f of PUBLISHED_SHARED) {
    const code = await readFile(join(sharedSrc, f), "utf8");
    await writeFile(join(outShared, f), code);
  }
  const sharedIndex = PUBLISHED_SHARED.map((f) => `export * from "./${f.replace(/\.ts$/, ".js")}";`).join("\n") + "\n";
  await writeFile(join(outShared, "index.ts"), sharedIndex);

  // 2. Published domain files (verbatim, shared import rewritten).
  for (const f of PUBLISHED_DOMAIN) {
    const raw = await readFile(join(domainSrc, f), "utf8");
    const guarded = assertNoClosedImport(f, raw);
    await writeFile(join(outDomain, f), rewriteSharedImport(guarded));
  }

  // 3. Stubbed domain files (public template, shared import rewritten).
  for (const [f, stubPath] of Object.entries(STUBBED_DOMAIN)) {
    const stub = await readFile(stubPath, "utf8");
    await writeFile(join(outDomain, f), rewriteSharedImport(stub));
  }

  // 4. A domain barrel that re-exports everything published + the fraud stub.
  // ranking.ts independently declares NEUTRAL_RELEVANCE / NEUTRAL_USER_PREFERENCE
  // with the same values relevance.ts / user-preference.ts own, so a flat
  // wildcard barrel is ambiguous (TS2308). We wildcard every module, then add an
  // explicit canonical re-export of those two names; an explicit re-export takes
  // precedence over `export *` and resolves the ambiguity.
  const files = [...PUBLISHED_DOMAIN, ...Object.keys(STUBBED_DOMAIN)].sort();
  const barrel = [
    ...files.map((f) => `export * from "./${f.replace(/\.ts$/, ".js")}";`),
    "",
    "// Canonical owners of the NEUTRAL_* constants (also declared in ranking.ts).",
    'export { NEUTRAL_RELEVANCE } from "./relevance.js";',
    'export { NEUTRAL_USER_PREFERENCE } from "./user-preference.js";',
    "",
  ].join("\n");
  await writeFile(join(outDomain, "index.ts"), barrel);

  // 5. Top-level barrel.
  await writeFile(
    join(base, "index.ts"),
    'export * from "./domain/index.js";\nexport * as formulas from "./shared/index.js";\n'
  );

  if (CHECK) {
    const drift = await diffDirs(srcDir, base);
    await rm(base, { recursive: true, force: true });
    if (drift.length > 0) {
      console.error("✗ open-algorithm mirror is OUT OF SYNC with the monorepo source:");
      for (const d of drift) console.error(`    ${d}`);
      console.error(
        "\nRun `node open-algorithm/scripts/sync.mjs` and commit the result to the public repo."
      );
      process.exit(1);
    }
    console.log("✓ open-algorithm mirror is in sync with the monorepo source.");
    return;
  }

  console.log(`✓ synced ${PUBLISHED_DOMAIN.length} domain formulas + ${PUBLISHED_SHARED.length} shared types`);
  console.log(`✓ fraud.ts replaced with public stub; excluded: ${EXCLUDED_DOMAIN.join(", ")}`);
}

/** Recursively list files under a dir as paths relative to it. */
async function listFiles(dir, prefix = "") {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(join(dir, e.name), rel)));
    else out.push(rel);
  }
  return out;
}

/**
 * Compare the committed mirror (`committed`) against a freshly-generated one
 * (`fresh`). Returns a list of human-readable drift descriptions (missing,
 * extra, or changed files). Empty means byte-identical.
 */
async function diffDirs(committed, fresh) {
  const drift = [];
  const [a, b] = await Promise.all([listFiles(committed), listFiles(fresh)]);
  const setA = new Set(a);
  const setB = new Set(b);
  for (const f of b) if (!setA.has(f)) drift.push(`missing from committed mirror: ${f}`);
  for (const f of a) if (!setB.has(f)) drift.push(`stale (not regenerated): ${f}`);
  for (const f of a) {
    if (!setB.has(f)) continue;
    const [ca, cb] = await Promise.all([
      readFile(join(committed, f), "utf8"),
      readFile(join(fresh, f), "utf8"),
    ]);
    if (ca !== cb) drift.push(`changed (source drifted): ${f}`);
  }
  return drift;
}

/** Fail loudly if a published file imports a closed module. */
function assertNoClosedImport(file, code) {
  for (const closed of EXCLUDED_DOMAIN) {
    const base = closed.replace(/\.ts$/, "");
    if (new RegExp(`from\\s+"\\./${base}\\.js"`).test(code)) {
      throw new Error(
        `Refusing to publish ${file}: it imports the closed module ./${closed}. ` +
        `Add a stub in open-algorithm/stubs/ and register it in STUBBED_DOMAIN, ` +
        `or remove the dependency before publishing.`
      );
    }
  }
  return code;
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
