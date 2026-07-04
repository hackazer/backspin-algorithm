# BackSpin Open Algorithm

[Website](https://usebackspin.com) ·
[Install](https://usebackspin.com) ·
[Buy attention](https://usebackspin.com) ·
[How it works](https://usebackspin.com/how-it-works) ·
[License](#license) ·
Source-available

**No black box.** This repository is the real BackSpin attention-exchange code:
the exact formulas that turn an AI wait state into paid attention for developers,
and into measured, fairly allocated reach for advertisers. The default revenue
split is **50/50: half to the developer whose machine showed the ad, half to
BackSpin.**

## The idea

When Claude Code, Codex, or another AI tool is thinking, it shows a throwaway
status line: "Generating...", "Thinking...", a random spinner verb. Cute, but it
is prime real estate doing nothing.

BackSpin turns that one line into a small, tasteful, relevant discovery slot.
Advertisers compete for it in an open exchange, and the developer whose machine
showed it earns up to half the revenue, credited automatically from the verified
attention the line actually received.

```text
- Generating... (esc to interrupt)
+ Railway - deploy your app in 60 seconds  railway.app (esc to interrupt)
```

No surveys. No "watch this video." You keep coding, and your balance ticks up in
the status bar:

```text
BackSpin  $(star) 142 credits  (about $0.71)
```

## What is BackSpin

BackSpin is an open attention exchange for AI-native workflows. While your AI
assistant is working (the "thinking" moment in Claude Code, Codex, Cursor, VS
Code, and the browser), BackSpin shows one small, relevant discovery card, then
verifies the attention it actually received and shares the revenue with the
developer whose machine showed it.

The unit is quality-adjusted human attention seconds, not raw impressions and
not clicks. Delivery is decided by a published, multi-factor score, never by
highest bid. Every number on the board is computed server-side and public.

## Get paid while you code

Add BackSpin to your AI CLI, your editor, or your browser, keep working as
normal, and earn verified attention credits during the wait states you already
sit through. There is nothing to click and nothing to run on a schedule. The
default revenue split is **50/50: you keep 50% of the value your verified
attention generates, and BackSpin keeps 50%.** Pick whichever surface matches
how you work (you can install more than one; they all earn to the same account
once connected).

### Option 1: CLI (Claude Code, Codex, OpenCode, and any terminal tool)

Install with one line. The installer auto-provisions a local account, so there
is no separate sign-in step to start earning.

```bash
# macOS / Linux
curl -fsSL https://usebackspin.com/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://usebackspin.com/install.ps1 | iex
```

```bash
# Alternative, once published to npm
npm install -g @usebackspin/cli
```

Then put `backspin` in front of the tool you want to wrap:

```bash
# Wrap a specific AI CLI (discovery shows during its wait states)
backspin claude                    # Claude Code
backspin codex                     # Codex CLI
backspin opencode                  # OpenCode
backspin cursor                    # Cursor
backspin windsurf                  # Windsurf
backspin zed                       # Zed

# Wrap any long-running command, not just AI tools
backspin npm test

# Wrap several at once
backspin run all                   # every known target found on your PATH
backspin run target=claude,codex   # only the targets you name
```

Manage and verify the install:

```bash
backspin run check                 # verify setup (auth + API connectivity)
backspin refresh                   # force-refresh the discovery card cache
backspin upgrade                   # self-upgrade to the latest version
backspin --help                    # show all commands
backspin --version                 # print the installed version
```

### Option 2: VS Code extension (VS Code, Cursor)

Until the Visual Studio Marketplace listing is live, install the packaged
extension with one line. It downloads the `.vsix` from usebackspin.com to a temp
file, then installs it (the CLI installs from a marketplace id or a local file,
so the download is part of the one-liner):

```bash
# VS Code
curl -fsSL https://usebackspin.com/dl/backspin-vscode.vsix -o /tmp/backspin.vsix && code --install-extension /tmp/backspin.vsix
```

```bash
# Cursor
curl -fsSL https://usebackspin.com/dl/backspin-vscode.vsix -o /tmp/backspin.vsix && cursor --install-extension /tmp/backspin.vsix
```

Reload when prompted. BackSpin then shows one discovery card in the panel and a
live credit balance in the status bar while your AI tool is working.

### Option 3: Browser extension (ChatGPT, Claude.ai, Gemini, Perplexity)

Until the Chrome Web Store and Firefox Add-ons listings are live, load it
unpacked. There are separate builds for each engine (Chromium uses an MV3
service worker; Firefox uses an MV3 event page), so download the one for your
browser:

**Chrome, Edge, Brave, Arc**

1. Download `backspin-extension-chrome.zip` from
   [usebackspin.com](https://usebackspin.com) and unzip it to a folder you keep.
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`),
   turn on **Developer mode**, click **Load unpacked**, and select the unzipped
   folder.

**Firefox**

1. Download `backspin-extension-firefox.zip` and unzip it to a folder you keep.
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary
   Add-on**, and select `manifest.json` inside the unzipped folder.

Then open ChatGPT, Claude.ai, Gemini, or Perplexity. A small discovery card
appears in the corner while the model generates.

The browser extension reads an AI chat page only to detect when a generation is
running and to render one card during that wait. It never reads or transmits
your prompts, the AI's responses, or page content; only attention metadata (that
a wait happened, how long a card was on screen, your ratings).

### Connect your earnings

On first run, BackSpin auto-provisions a local account and hands it an opaque
public code, so you can start earning immediately with no sign-in. Your verified
credits accrue to that code. To make them claimable and withdrawable, link the
code to a real account with your email at
[usebackspin.com](https://usebackspin.com) (Sync and connect). Linking keeps all
the credits you already earned attached to the same identity, and the CLI, the
VS Code extension, and the browser extension all accrue to one account once
connected.

## Where the ad shows up

One discovery slot, rendered natively on every surface. It is always a single
line or a small card, never a banner, and always dismissible.

| Surface | Where | Needs |
| --- | --- | --- |
| Status-bar line | VS Code / Cursor (BackSpin extension) | The BackSpin VS Code extension |
| Webview card | VS Code panel during AI wait states | The BackSpin VS Code extension |
| Terminal status line | Claude Code, Codex, OpenCode (CLI wrapper) | The BackSpin CLI wrapping the tool |
| Corner card | ChatGPT, Claude.ai, Gemini, Perplexity (browser) | The BackSpin browser extension |

The CLI replaces the AI's own "Generating..." status line with the discovery
line for exactly the row the spinner occupied, then restores normal output when
the wait ends. Nothing breaks if a surface is unsupported: BackSpin simply shows
nothing and stays invisible.

## How the money works

- **The unit is the attention-second, not the impression and not the click.** An
  attention-second is one verified second of genuine attention on the discovery
  card, discounted by an attention-quality score so a half-noticed surface earns
  less than a fully engaged one.
- **Advertisers buy with a CPAS bid and a budget.** CPAS is the cost per 1,000
  quality-adjusted attention-seconds. The bid sets share of voice; the budget
  caps total spend. Advertisers pay only for attention that clears the fraud
  filter.
- **Not highest-bid-wins.** An open, published score decides whose ad shows and
  when: bid times relevance times attention quality times user preference times
  advertiser reputation times a fairness boost for new campaigns. A bigger
  budget cannot buy past a low-quality or badly-rated ad.
- **Revenue share.** Up to 50% of the value a window generates accrues to the
  developer whose editor or terminal rendered the ad. The default split is 50%
  developer, 50% BackSpin.
- **Real-time balance.** Verified credits appear live in your VS Code status bar
  and CLI, with the full ledger at [usebackspin.com](https://usebackspin.com).
  Credits convert at 1,000 credits = $5.00.

## Buy attention (advertisers, companies, tool maintainers)

If you build a developer tool, an MCP server, an API, a cloud platform, a
template, a job post, a grant, or a bounty, BackSpin puts it in front of
developers at the exact moment they are between tasks and open to discovery.

You buy verified, quality-adjusted attention seconds with a CPAS bid and a
budget cap. You only pay for attention that clears the fraud filter, and your
share of voice is set by relevance and reputation, not by who spends most.

No account is required to start: place a quick bid with just an email and you
get a public code on your receipt. To track and manage those purchases, paste
the code under Sync and connect on the dashboard to load every order tied to it,
then, once signed in, link it to your advertiser account so all prior spend and
orders carry over to the portal permanently.

Start an open-exchange campaign at
[usebackspin.com](https://usebackspin.com).

## What is in this repository (the real formulas)

These files are copied verbatim from the BackSpin production monorepo by a sync
script, so the public formulas cannot drift from what runs in production.

| File | What it computes |
| --- | --- |
| `src/domain/scoring.ts` | AttentionScore (activity, focus, session quality, workflow relevance, trust, minus fraud risk), eligibility, and reward. |
| `src/domain/ranking.ts` | CampaignScore (six factors) plus allocation: a fair base floor, purchased share of voice, per advertiser and per category caps, and a new campaign boost. Not highest bid wins. |
| `src/domain/relevance.ts` | Category by workflow relevance multiplier. |
| `src/domain/reputation.ts` | Advertiser reputation from ratings and attention quality. |
| `src/domain/user-preference.ts` | Per category viewer sentiment multiplier. |
| `src/domain/trust.ts` | TrustRank from prior eligible and total history. |
| `src/domain/revenue-split.ts` | User, partner, and BackSpin split math. |
| `src/domain/market-price.ts` | Live CPAS clearing price from supply and demand. |
| `src/domain/display-rules.ts` | Card format chosen by wait length. |
| `src/shared/` | The formula types and economic constants the domain imports. |

## What is intentionally not here

`src/domain/fraud.ts` is a documented stub that always returns `0` (no fraud).
The fraud and anti-abuse engine is the one deliberately closed part of the
open-trust split: the methodology is public, but the exact signals and
thresholds stay private so they cannot be gamed. The stub keeps the package
compiling and reproduces production exactly for honest traffic, because
production also scores genuine attention with near zero fraud risk. Only the
abuse path differs.

The cross account farm engine, install origin hashing, and attribution token
signing are excluded for the same reason.

## Verify it yourself

```bash
npm install
npm run typecheck   # the mirror compiles standalone
```

## How this stays honest

A maintainer regenerates this package from the monorepo with `node scripts/sync.mjs`.
The script copies the real source, swaps in the fraud stub, and refuses to
publish if any open file imports a closed module. The mirror is never hand
edited, so "checked against the live code" stays true.

The fraud stub has a second, structural guard: the sync script asserts that
`computeFraudRisk`'s body is exactly `return 0;` before publishing. A careless
edit that drops real signals or weights into the public stub fails the sync (and
the `--check` drift test), so the one closed file cannot leak its logic even by
accident. The real engine lives in the private monorepo and is never copied
into this repository.

## Who builds BackSpin

BackSpin is led by **Rizaldy Primanta Putra**, former Chainstack and Edgevana blockchain engineer.

## License

This repository ships under two layers:

1. **This algorithm mirror is open source (MIT).** You may read, use, copy,
   modify, and distribute the formula code in `src/` under the terms in
   [LICENSE](./LICENSE). It is published so the exchange can be audited.

2. **The BackSpin platform itself is proprietary and source-available, not open
   source.** Copyright 2026 BackSpin. All rights
   reserved. The production service, the fraud and anti-abuse engine, the
   ledger, and the surrounding product are not licensed for use, copying,
   modification, distribution, or commercialization without a written license.
   Commercial inquiries: support@usebackspin.com.
