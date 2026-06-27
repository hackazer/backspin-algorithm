# Publishing the open-algorithm mirror to its own GitHub repo

`open-algorithm/` lives inside the monorepo but is published as a **separate,
standalone public repo** (its own git history, not a subfolder of this one).

## One-time setup

1. Create an empty public repo on GitHub, e.g. `hackazer/backspin-algorithm`
   (no README/license — this folder provides them).

2. Regenerate the mirror from the monorepo source of truth:

   ```bash
   # from the monorepo root
   node open-algorithm/scripts/sync.mjs
   ```

3. Initialize a git repo INSIDE this folder and push it to the new remote:

   ```bash
   cd open-algorithm
   git init -b main
   git add -A
   git commit -m "Open the BackSpin attention-exchange formulas"
   git remote add origin https://github.com/hackazer/backspin-algorithm.git
   git push -u origin main
   ```

   The monorepo ignores `open-algorithm/.git`, `open-algorithm/src/`, and
   `open-algorithm/node_modules/`, so this inner repo never tangles with the
   outer one.

## Every update afterward

```bash
node open-algorithm/scripts/sync.mjs   # from monorepo root: refresh from live code
cd open-algorithm
git add -A
git commit -m "Sync formulas from production"
git push
```

## What ships vs. what is held back

- Published verbatim: scoring, ranking, relevance, reputation, user-preference,
  trust, revenue-split, market-price, display-rules + the shared formula types.
- Stubbed (compiles, logic private): `domain/fraud.ts` (always returns 0).
- Excluded: farm engine, origin-hash, attribution-token.

The sync script fails loudly if an open file ever imports a closed module, so a
future change cannot leak the fraud heuristics by accident.
