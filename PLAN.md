# REELAZO — Atomic Implementation Plan

A roulette analysis engine. Free, no real money, monetized by display ads.

---

## 0. Identity

| | |
|---|---|
| Name | **REELAZO** |
| Tagline | "La publicidad es tu combustible." |
| Package | `reelazo` |
| Repo | `Ads-Bet-an-ads-game` |
| Language of product | **English** (i18n-ready) |
| Deployment | GitHub Pages via Actions, `base: './'` |

The name contains "reel", which is also the roulette mechanism. It reads
aloud correctly and is spellable after one hearing.

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
- Because the ads no longer fuel anything, `cadence.ts` loses its purpose.
  The scheduler is deleted; `provider.ts` is retained as the boundary that
  guarantees a click can never reach game state. The invariant survives even
  though the fuel mechanic does not.
- `docs/ad-provider-audit.md` records the findings: the embed is an iframe
  display unit, no completion event, no rewarded format on web, therefore
  energy-on-completion is not implementable and was never shipped.

### F10 — strategy engine + batch simulator
`src/sim/strategies.ts` — eight strategies, each
`nextBet(state) -> Bet[] | null`, pure, with table limits.
`src/sim/engine.ts` — `run(strategy, config) -> Series` producing equity,
drawdown, ruin flag, EV, peak. **Must not allocate per spin.**
`src/sim/worker.ts` — Web Worker so four strategies × 1M spins never blocks the
UI thread.
`src/sim/charts.ts` — Canvas line charts for equity curves, bar chart for
distribution. No charting dependency; the bundle budget forbids it.
`src/sim/simulator.html` — strategy picker, spin count, seed, run button,
live-updating curves, and the summary table reading EV / variance / drawdown /
ruin probability.
Tests: martingale doubles after a loss and clamps at the table limit; each
strategy terminates; the simulation over a fixed seed matches a stored
checksum; `noZero` shows EV ≈ 0 where European shows ≈ −0.027.

### F11 — encyclopedia
`src/content/index.ts` — data-driven article registry. `encyclopedia.html`
renders it. Articles cover the wheel variants, the bet types and their real
odds, the house edge and variance, strategy bankruptcy mechanics, the
house-edge-per-bet derivation, probability and combinatorics, simulation
method, RNG fairness, and a glossary. Every article is a content entry, so
adding one is a data change, not a code change — and every string goes
through `t()`.

### F12 — design system + responsive
Multi-page shell (header, nav, footer) shared by all three pages. Casino
visual language: deep navy `#0B1026`, brass `#C9A227`, felt green `#0E5C3F`,
bone `#F5F2E8`. Serif display face for headings, tabular figures for all
numbers, gold used only for emphasis and the active state — never as a fill.
- Verified at 320 / 360 / 390 / 430 / 768 / 1280 px.
- No horizontal scroll at any width. The number grid must fit 320 px without
  shrinking a hit target below 44 px.
- `env(safe-area-inset-*)` respected on notched devices.
- Long tasks fragmented; no layout thrash on spin.
- `prefers-reduced-motion` honoured globally.

### F13 — CI, deploy, README
`.github/workflows/deploy.yml` — `npm ci` → `verify` → size-budget gate →
deploy `dist/` to `gh-pages`. npm cache. A concurrency group so two pushes
cannot race a deploy. `.github/ISSUE_TEMPLATE/`. README rewritten for
roulette, aads.com, English, and the architecture as built.

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
- House edge proven to 4 dp on every variant; straight-up pays exactly 35:1.
- Switch to Spanish, then German: only a dictionary file is added.
- One push deploys it.
- **No line of code anywhere grants, increments, or animates anything in
  response to an ad interaction.**

---

## 7. Open Items

1. **aads.com publisher zone ID.** The supplied unit `2457816` is integrated
   as given. Confirm it is approved for this domain before launch; until then
   the site renders with the slot empty, which is a supported state.
2. **Target ad views per session** — cosmetic now that ads are not fuel.
3. **Whether the encyclopedia should ever include the public-domain texts**
   (download, not email).

---

## 8. Commit History

| Hash | Phase |
|---|---|
| `722f12b` | F0 repository |
| `1410cd3` | F1 scaffold |
| `17d73b7` | F2 seeded RNG |
| `7c74673` | F3 canvas + HUD |
| `e728cf7` | F4 ad abstraction |