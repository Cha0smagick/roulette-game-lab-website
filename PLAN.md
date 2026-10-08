# REELAZO — Atomic Implementation Plan

A roulette analysis engine. Free, no real money, monetized by display ads.

---

## 0. Identity

| | |
|---|---|
| Name | **REELAZO** |
| Tagline | "La publicidad es tu combustible." |
| Package | `reelazo` |
| Repo | `roulette-game-lab-website` |
| Language of product | **English** (i18n-ready) |
| Deployment | GitHub Pages via Actions, `base: './'` |

The name contains "reel", which is also the roulette mechanism. It reads
aloud correctly and is spellable after one hearing.

The repository is `roulette-game-lab-website` while the npm package stays
`reelazo`. The two serve different audiences and the split is deliberate: the
repository name is a URL a visitor types and the Pages path is derived from it,
so it should describe what the project does; the package name is the brand that
appears on the site. Renaming the repository therefore changes the published URL
to `/roulette-game-lab-website/` and touches no build configuration, because
`base: './'` makes every asset reference relative.

---

## 1. Six Ground Rules

These are not style preferences. Each one exists because breaking it has
already cost someone money or shipped a broken page.

1. **`npm run verify` must be green before every commit.**
   `typecheck && test && build`. No exceptions, no `--no-verify`.

2. **CI hard-fails if the gzipped bundle exceeds 120 kB.**
   Bundle size is retention. Every kilobyte is abandonment, and abandonment
   is lost impressions. The budget is enforced by the pipeline, not by
   discipline.

3. **No `any`. No `@ts-ignore`. No empty `catch`.**
   `strict` plus `noUncheckedIndexedAccess` plus `exactOptionalPropertyTypes`.
   Suppressing a type error is moving the failure to runtime.

4. **Ads live behind one interface and grant nothing.**
   `AdProvider` exposes `load()`, `show(slot)`, `isReady()`. It exposes
   nothing click-shaped: no `onClick`, no `clicked` result, no callback a
   click could reach. Zero ad code in `src/game/`. The reason is in
   `provider.ts` and must stay there.

5. **No personal data. No fingerprinting. No third-party analytics.**
   The only network calls this site makes are to the ad network. Metrics are
   local counters the player can read and delete.

6. **Comments explain *why*, never *what*.**
   If the code already says what it does, the comment is noise.

---

## 2. The Mathematics Is the Product

A roulette "prediction engine" is a contradiction: the wheel is a physical
random process, and no method predicts it. So this engine does not predict.
It **measures**, and the measurement is honest:

- Every bet type publishes its true payout and true probability.
- Every wheel variant publishes its exact house edge (2.70% / 5.26% / 0.00%).
- Every strategy reports EV per spin, variance, max drawdown, and probability
  of ruin — computed by running it, not asserted.
- The `noZero` variant has **zero house edge**. It exists to demonstrate what
  "fair" actually means: EV is 0, and no strategy changes that.
- The engine's conclusion is the one the mathematics gives. It does not
  flatter the player.

RNG is seeded (`sfc32`) and the seed is displayed, so any session can be
replayed and audited spin by spin.

**Bet types — full casino set, for all three variants:**

| Bet | Numbers | Payout (noZero / EU / US) |
|---|---|---|
| Straight | 1 | 35:1 / 35:1 / 35:1 |
| Split | 2 | 17:1 / 17:1 / 17:1 |
| Street | 3 | 11:1 / 11:1 / 11:1 |
| Corner | 4 | 8:1 / 8:1 / 8:1 |
| Line | 6 | 5:1 / 5:1 / 5:1 |
| Column | 12 | 2:1 / 2:1 / 2:1 |
| Dozen | 12 | 2:1 / 2:1 / 2:1 |
| Red / Black | 18 | 1:1 |
| Odd / Even | 18 | 1:1 |
| Low / High | 18 | 1:1 |

Payouts are constants; the house edge emerges from the zero count. This is
verified in tests, not assumed.

**Strategies in the simulator** — flat, martingale, reverseMartingale,
labouchere, fibonacci, dAlembert, oscarGrind, columnProgression. Each is a
pure generator with table-limit clamps and a documented bankruptcy rule.

---

## 3. Phase Ledger

One commit per phase. Commit only after `verify` passes.

### F0 — repository ✅ done
`.gitignore`, `LICENSE` (MIT), `README.md`, `PLAN.md`. Tooling dirs
(`.omo/ .opencode/ .codegraph/ undefined/`) ignored — agent artifacts never
get committed.

### F1 — scaffold ✅ done
Vite + TypeScript strict. Correct mobile viewport
(`width=device-width, initial-scale=1, viewport-fit=cover`) — a wrong viewport
is the number-one cause of desktop-width rendering on a phone.
`touch-action: manipulation`. Safe-area insets. Boot markup in `index.html` so
a failed bundle can never render a blank page. No framework.

### F2 — seeded RNG ✅ done
`src/util/rng.ts` — `sfc32`, `createRng`, `seedFromString`, serializable
state. 12-output warm-up. Modulo bias < 1e-7, stated explicitly. This is the
fairness guarantee and it is reusable by the roulette core unchanged.

### F3 — canvas renderer + animation ✅ done (slots)
`src/ui/anim.ts` (single shared rAF, delta-time so 120 Hz equals 60 Hz,
50 ms clamp so a backgrounded tab cannot teleport) and `src/ui/reel.ts`.
**`reel.ts` is deleted in F6** and replaced by the wheel renderer. `anim.ts`
survives — the wheel uses the same ticker.

### F4 — ad abstraction ✅ done
`src/ads/{provider,mock,cadence}.ts`. The `AdProvider` interface, the mock
that simulates failed fills, and the cadence scheduler. Carried forward with
one change: energy is no longer "spin fuel" (see F9).

### F5 — i18n foundation
- `src/i18n/types.ts` — the English dictionary **is** the source of truth;
  `TranslationKey` is derived from it, so a missing translation is a compile
  error, not a runtime surprise.
- `src/i18n/locales/en.ts` — complete.
- `src/i18n/locales/es.ts` — complete. Shipping a second language proves the
  system works instead of claiming it does.
- `src/i18n/index.ts` — `t(key, vars)`, `<html lang>` mutation, persistence in
  `localStorage`, `Intl.NumberFormat` for numeric formatting.
- Every visible string in the product becomes `t('key')`. **No hardcoded copy
  in any component.** A test scans `src/**` for user-facing string literals
  outside the locale files and fails the build on a hit.

### F6 — roulette core (pure, no DOM)
- `src/roulette/wheels.ts` — three variants with the **real number order**
  (European `0,32,15,19,4,21,...`; American `0,28,9,26,30,11,...`). Red/black
  sets. `noZero` = 1–36, edge exactly 0.
- `src/roulette/bets.ts` — the ten bet types above as pure predicates
  `covers(bet, number) -> boolean` plus payout constants.
- `src/roulette/settle.ts` — `settle(bets, outcome) -> Payout[]`. Pure.
- `src/roulette/edge.ts` — house edge and EV per bet per variant, derived, not
  hardcoded.
- `src/roulette/history.ts` — spin history, streak detection, hot/cold counts.
- **Deleting** the slot files: `paytable.ts`, `spin.ts`, `types.ts`,
  `reducer.ts`, `reel.ts`, `hud.ts`, `session.ts` and their tests.
- Tests: every bet type on every variant. Straight-up pays 35:1 exactly. Line
  bet covers exactly 6 numbers. Corner covers exactly 4 and no 5. Column
  covers 12. **House edge asserted to 4 decimal places per variant** —
  0.0257 / 0.0526 / 0.0000. A zero edge must be exactly zero, not approximately.
  These are the assertions that make this an engine rather than a slot machine.

### F7 — wheel renderer
`src/ui/wheel.ts` — Canvas 2D. Real pocket layout, red/black/green with correct
color, number labels, ball orbiting with easing, staggered settle onto the
pocket. Honours `prefers-reduced-motion` by cutting straight to the result.
Device pixel ratio clamped to 3.

### F8 — betting board + live table
`src/ui/board.ts`, `src/ui/chips.ts`, `src/game/table.ts` (session state as a
pure reducer: balance, chips placed, clear, undo, rebet, result).
- Full board: dozens, columns, the 0 / 00 cells, all inside bets (street,
  corner, line, split) on the number grid — corner and line drawn as overlay
  strokes so the grid stays readable on a 320 px screen.
- Chip selection with keyboard support. Every control is a real `<button>`
  with an accessible name, reachable by keyboard, with a ≥44 px touch target.
- Result is announced to screen readers via a live region, not only drawn.

### F9 — aads.com integration
`src/ads/aads.ts` — the real adapter using the supplied unit:

```html
<!-- BEGIN AADS AD UNIT 2457816 -->
<div id="frame" style="width: 100%;margin: auto;position: relative; z-index: 99998;">
  <iframe data-aa='2457816' src='//acceptable.a-ads.com/2457816/?size=Adaptive'
    style='border:0; padding:0; width:70%; height:auto; overflow:hidden;display: block;margin: auto'></iframe>
</div>
<!-- END AADS AD UNIT 2457816 -->
```

- The unit is **display-only**. No completion callback exists on web, so
  **nothing in the game waits on it and nothing is granted by it.**
- `src/ui/adslot.ts` mounts it inside a delimited, reserved region. It never
  overlays a control — an accidental click is invalid traffic. The unit's own
  `z-index: 99998` is overridden locally so it cannot cover the board.
- The adaptive unit is mounted **only after the table is interactive**. An ad
  that shifts layout while the player is mid-bet is a layout-thrash bug and a
  misclick source.
- Because the ads no longer fuel anything, `cadence.ts` loses its purpose and
  the scheduler is deleted. **`provider.ts` and `mock.ts` are deleted too, which
  is a change to the plan as written.** The reasoning: a comment inside an
  interface nothing imports is documentation, not a boundary. The incentive-to-
  click invariant now rests on assertions in `test/ads.test.ts` — no module
  under `src/game` or `src/roulette` may import from `src/ads`, no module under
  `src/ads` may contain click handling in its code, and none may export a
  `show()`/`load()` lifecycle the game could await. A test that fails is a real
  boundary; a comment is not.
- `docs/ad-provider-audit.md` records the findings: the embed is an iframe
  display unit, no completion event, no rewarded format on web, therefore
  energy-on-completion is not implementable and was never shipped.

### F10 — strategy engine + batch simulator
`src/sim/strategies.ts` — eight strategies (flat, martingale, reverseMartingale,
labouchere, fibonacci, dAlembert, oscarGrind, columnProgression), each a
**`plan(run, variant) -> BetPlan` plus an `advance(run, won) -> run`** pair, both
pure, with a table-limit clamp and no access to the RNG. Progressions are
counted in UNITS of `minBet` and converted to a stake once, so the clamp and the
bankroll arithmetic stay exact integer operations.
`src/sim/engine.ts` — `runOne(request) -> RunResult` and
`runBatch(batch) -> RunResult[]`, producing final bankroll, wagered, EV per spin,
ROI, max drawdown, a ruin flag with the spin it happened on, and a downsampled
equity curve. **The inner loop allocates nothing that grows with the spin
count**: it calls `settleOne` rather than `settle`, so no bet array, settlement
or winner array is built per spin; the sample schedule is an `Int32Array` walked
with one pointer; and the curve is capped at `EQUITY_SAMPLE_CAP = 240` points.
Each system gets its own seeded stream (`seed:strategyId`) so eight runs are
independently reproducible and are not coupled to each other's draw order.
**A system that demands more than the bankroll is declared ruined, not quietly
reduced to an affordable bet** — that decision is the one these systems are
supposed to fail at.
`src/sim/protocol.ts` — the Worker wire types, in a types-only module so the page
can import them without executing the Worker body.
`src/sim/worker.ts` — Web Worker so eight systems × 300k spins never blocks the
UI thread. Holds no state between messages, so a stale reply from an abandoned
run cannot corrupt a later one.
`src/sim/client.ts` — page-side handle, promise per run id, with a documented
same-thread fallback when `Worker` is unavailable.
`src/sim/charts.ts` — Canvas equity curves and a horizontal bar chart. **No
charting dependency; the bundle budget forbids it.** Pure geometry
(`equityScale`, `xFor`, `yFor`) is exported and tested with no canvas. All series
share one y-range, because per-series autoscale would make a system that lost
ninety percent look identical to one that won — the exact inversion the tool
exists to prevent.
`src/simulator.ts` + `simulator.html` — strategy picker, wheel, bankroll, spins,
table limit, seed, equity points, run button, equity chart, bar chart and a
summary table reading final bankroll / EV per spin / ROI / max drawdown / verdict.
`vite.config.ts` gains `rollupOptions.input` for `index.html` and
`simulator.html`, which makes this a real multipage build; `encyclopedia.html`
is added in F11 when it exists.

**Deviations from this plan as written:**
- The strategy API is `plan` + `advance`, not `nextBet(state) -> Bet[] | null`.
  A generator that could return `null` would need the engine to ask "what now?"
  on every spin, and the two-function shape makes the fold-of-the-result
  explicit and separately testable.
- `src/roulette/settle.ts` gained `settleOne(placement, stake, outcome)` and
  `settle` now delegates to it. This is deliberate: it keeps exactly one
  implementation of the payout arithmetic, so the simulator cannot drift away
  from what the live table pays, and it is what makes the allocation rule
  above achievable.
- The shared header and footer moved out of `main.ts` into `src/ui/shell.ts`,
  because a nav that disagrees with itself across pages is a bug nobody can
  reproduce. Doing this also surfaced that `.shell__header`, `.shell__nav`,
  `.shell__link`, `.shell__footer` and `.shell__disclaimer` had **no CSS at
  all** — the nav has been rendering unstyled since F8. Those rules now exist in
  `base.css`, and `.shell__link--current` carries `aria-current="page"` as well
  as the colour, because a screen reader gets nothing from the colour.

Tests: every id registered with a definition and a translated label; every planned
bet is structurally legal and covers at least one pocket on all three wheels;
martingale doubles after a loss and clamps at the table limit; reverse martingale
doubles after a win; labouchere crosses a pair off on a win, appends on a loss and
restarts when the cycle completes; fibonacci steps forward and back and clamps;
d'Alembert never drops below the base unit; Oscar Grind returns to one unit after
a single loss; column progression advances and wraps; no system ever exceeds the
table limit; `settleOne` and `settle` agree profit-for-profit; a run is
deterministic for a seed; systems get independent streams; ruin reports the spin
it happened on; the equity curve is bounded and ends on the reported final
bankroll; a zero-spin request does not divide by zero; and **the thesis itself —
every system is negative on a wheel with a zero, and the mean across systems on
the zero-edge wheel sits within 0.01 of zero.** That last assertion is the one
the page exists to support, and it is measured over 8 × 300 000 spins rather
than restated.

### F11 — encyclopedia
`src/content/index.ts` — data-driven article registry. `encyclopedia.html`
renders it. Articles cover the wheel variants, the bet types and their real
odds, the house edge and variance, strategy bankruptcy mechanics, the
house-edge-per-bet derivation, probability and combinatorics, simulation
method, RNG fairness, and a glossary. Every article is a content entry, so
adding one is a data change, not a code change — and every string goes
through `t()`.

### F12 — design system + responsive
As built: `:root` in `base.css` became a real token layer (surfaces, accent, ink,
interaction, betting-only colours, brass steps, type scale, spacing,
`--touch-target: 44px`, `--measure`), and every hex literal in the four
page/board stylesheets was replaced with a `var()` reference. The canvas
renderer's palette is now `export`ed and a test reads the custom properties out of
`base.css` and compares them against it — because the wheel was drawing a brass
rim from `#c9a227` while the spin button painted its gradient from `--amber:
#ffb03a`, two golds that never matched on screen, and CSS and canvas share no
channel that would have noticed.

`test/design-system.test.ts` (16 tests) enforces: the tokens exist; canvas
matches the tokens; no stylesheet other than `base.css` contains a hex literal;
every page carries the correct viewport meta in the correct order; no page pins
zoom; no layout declares a fixed or minimum width above 320 px; all four
safe-area insets are present; `100dvh` is used and `100vh` is not; every
stylesheet that declares `transition` also declares `prefers-reduced-motion`; and
a stylesheet using `white-space` also declares `overflow-x`.

**Deviation from the plan, stated plainly:** the plan claimed verification *at*
320 / 360 / 390 / 430 / 768 / 1280 px. What actually happened is a **static audit
of the CSS and HTML** against those viewports — real checks of a real class of
bug, but not the same as rendering the pages. Nothing in this project has yet been
opened in a real browser. That gap is listed in the README rather than papered
over.

### F13 — CI, deploy, README
`.github/workflows/deploy.yml` — four gates in this order, and the order is the
point: `npm ci` → `npm run verify` → the size budget → publish. The size budget is
`scripts/size-budget.mjs`, a script rather than an inline CI step so that
`npm run size` and the CI gate are literally the same check, runnable locally
before a push instead of only telling you that you were wrong in public. It
gzips every file in `dist/` — all three pages, every chunk and the worker —
because what a visitor downloads is the sum, and a budget that only looked at one
entry point would let a 90 kB script walk past it unnoticed. Fails over 120 kB;
the site currently sits at about 34 kB. `concurrency: pages` with
`cancel-in-progress: false`, so two pushes a minute apart cannot publish out of
order and leave the live site on the older commit.

`.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml` — the feature
template's four required checkboxes are the project's non-mergeable rules, put
where a contributor will actually read them. `.github/pull_request_template.md`
states the same four things with the reasoning.

One operational caveat that the workflow cannot fix by itself: **Settings →
Pages → Source must be set to "GitHub Actions"**. Left on a branch, the workflow
runs green and then cannot publish, and the failure does not name the cause. It
is documented in the README.

`README.md` rewritten for roulette, aads.com, English, and the architecture as
built — including the honest gaps (no visual QA, ad unit not yet approved for the
domain, no history-of-the-game writing).

---

## 4. Dependency Graph

```
F5 i18n ──┬─→ F6 core ──┬─→ F7 wheel ──→ F8 board ──┐
          │              │                          ├─→ F12 design ──→ F13 CI
          └──────────────┴─→ F10 sim ──→ F11 encyc ┘
                        F9 ads ─────────────────────┘
```

F6 is the critical path and the only phase where a math error is possible.
It gets its own commit and its own tests before anything renders.

---

## 5. Explicitly Deferred

| Item | Why not now |
|---|---|
| Email delivery of public-domain texts | Requires a backend (serverless fn for the API key, captcha, rate limit, consent). A public mail form is a spam magnet and gets the sending domain blacklisted. Direct download from the browser is better anyway. |
| Leaderboards | Needs accounts and a backend. |
| PWA / offline | Needs a stable asset pipeline first. |
| Native shell | Platform closed: web only. |
| Any second ad network | One integration stays auditable. |

---

## 6. Definition of Done

- Runs on a 320 px phone in a browser, three pages, zero console errors.
- `npm run verify` green; size budget holds.
- House edge proven to 12 dp on every variant; straight-up pays exactly 35:1.
- Switch to Spanish, then German: only a dictionary file is added.
- One push deploys it. **Met:** Pages is set to build from GitHub Actions and the
  workflow publishes `dist/` to it.
- **No line of code anywhere grants, increments, or animates anything in
  response to an ad interaction.**

The first bullet of this list is **not yet met**, and the reason is worth more
than the bullet: `npm run verify` cannot tell you that a page renders. Nothing in
this project has been opened in a real browser at any viewport, and the site is
now published, so that gap has a visible consequence rather than a theoretical
one. The CSS and HTML have been audited statically (viewport meta, fixed widths,
safe areas, touch targets, zoom pinning), which is a real check of a real class
of bug and is not the same as looking at the thing.

---

## 7. Open Items

1. **aads.com publisher zone ID.** The supplied unit `2457816` is integrated
   as given. Confirm it is approved for this domain before launch; until then
   the site renders with the slot empty, which is a supported state.
2. **Target ad views per session** — cosmetic now that ads are not fuel.
3. **Whether the encyclopedia should ever include the public-domain texts**
   (download, not email).
4. **Visual QA.** Open all three pages in a real browser at 320 / 360 / 390 /
   430 / 768 / 1280 px, check the console is clean, and confirm the wheel lands
   on the number the reducer settled. Until that happens the responsive work is a
   static audit and the first bullet of the definition of done is unmet. The site
   is now published, which makes this the highest-value remaining item: it is the
   only open item whose failure mode is a visitor seeing a broken page.
5. ~~**GitHub Pages source must be set to "GitHub Actions"**~~ — **done.** The
   setting has been applied in the repository settings, so the deploy workflow can
   publish. Kept as a numbered item rather than deleted because the failure mode
   is worth remembering: the workflow does not fail when this is wrong, it passes
   and then silently does not publish.

---

## 8. Commit History

| Hash | Phase |
|---|---|
| `722f12b` | F0 repository |
| `1410cd3` | F1 scaffold |
| `17d73b7` | F2 seeded RNG |
| `7c74673` | F3 canvas + HUD |
| `e728cf7` | F4 ad abstraction |