# Implementation plan — REELAZO

Atomic, engineer-ordered. **One phase = one commit. A commit is only made when its
verification command passes.** No commit is ever made with a failing build.

Target: static site, `master` branch, deployed to `gh-pages` by GitHub Actions.
Platform: **web only, 100% mobile-first responsive.** No native shell, no backend.

Ad provider: **aads.com (Anonymous Ads)** — see `docs/ad-provider-audit.md`.

---

## 0. Naming and identity (settled)

| Item | Value | Why |
|---|---|---|
| Product name | **REELAZO** | 7 characters. Spanish. The `-azo` suffix is a proven Latin-American branding pattern that carries "big hit / good time" (`relajazo`, `ventazo`). It contains "reel" inside it, so the name explains the game without a tagline. Readable over a phone call, spellable after hearing it once. |
| Fallback / domain | `reelazo.app`, `juegareelazo.com`, `reelazo.juego` | — |
| Codename in code | `reelazo` | package name `reelazo` |
| Voice | Spanish (Latin American), short sentences, no casino jargon that implies money | the product is a web game, not a bank |
| Tagline | "La publicidad es tu combustible." | states the mechanic in six words |

---

## 1. Ground rules for every phase

1. `npm run verify` = `tsc --noEmit` + `vitest run` + `vite build`. Must be green.
2. Bundle size is checked in CI against a hard budget (see F8). Exceeding it fails the build.
3. No `any`. No `@ts-ignore`. No empty `catch`. Non-negotiable.
4. The ad integration is one interface (`AdProvider`) with a mock implementation used by
   tests. No ad code leaks into `src/game/`.
5. Nothing that reads or stores personal data. No network calls except the ad network's.
6. Comments explain *why*, not *what*. Every non-obvious constant gets a reason.

---

## 2. Phase ledger

### F0 — Repository hygiene

- **Commit:** `chore: initialize repository`
- **Files:** `.gitignore`, `LICENSE`, `README.md`, `PLAN.md`
- **Work:** ignore `node_modules/`, `dist/`, `.vite/`, `coverage/`, and the local tooling
  directories `.omo/`, `.opencode/`, `.codegraph/`, `undefined/` (these are agent/tooling
  artifacts, not project source, and must never be committed). Add MIT license.
- **Done when:** `git status --porcelain` is empty after commit, and no tooling path is
  tracked.

### F1 — Build scaffold

- **Commit:** `feat: scaffold vite + typescript strict with mobile-first shell`
- **Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
  `src/main.ts`, `src/styles/base.css`, `.editorconfig`
- **Work:** Vite + TypeScript `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`. `index.html` sets the mobile viewport correctly
  (`width=device-width, initial-scale=1, viewport-fit=cover`) — getting this wrong is the
  #1 cause of a game that renders at desktop width on a phone. Base CSS: dark theme, no
  user-select on the play surface, `touch-action: manipulation` to kill the 300 ms tap
  delay, safe-area insets reserved. A visible "boot" element so a blank page is never a
  possible outcome.
- **Done when:** `npm run dev` serves a themed page and `npm run verify` is green.
- **Note:** no framework. A framework on a GitHub Pages mobile game costs first-load time,
  and first-load time is abandonment, and abandonment is lost impressions.

### F2 — Deterministic core (pure, fully tested)

- **Commit:** `feat: seeded rng, published paytable and spin resolution`
- **Files:** `src/util/rng.ts`, `src/game/types.ts`, `src/game/paytable.ts`,
  `src/game/spin.ts`, `src/game/state.ts`, `src/game/reducer.ts`,
  `test/rng.test.ts`, `test/paytable.test.ts`, `test/spin.test.ts`
- **Work:**
  - `rng.ts`: mulberry32 or sfc32. Seeded, serializable state, so a spin can be replayed
    from its seed for debugging and for fairness disputes.
  - `paytable.ts`: the 3-reel weighted table, declared as data, **rendered in-game so the
    player can read it**. A published paytable is the whole difference between a game and
    a scam.
  - `spin.ts`: pure function `(rng, bet) => Outcome`. No timers, no DOM.
  - `reducer.ts`: every state transition is an explicit action → state function.
- **Done when:** unit tests cover the RNG distribution, the paytable sums, and that a
  known seed always reproduces the same outcome. `verify` green.

### F3 — Reel rendering and input

- **Commit:** `feat: canvas reel renderer, spin animation and hud`
- **Files:** `src/ui/reel.ts`, `src/ui/hud.ts`, `src/ui/anim.ts`, `src/game/session.ts`,
  `src/styles/reel.css`
- **Work:** Canvas 2D reel renderer driven by a single `requestAnimationFrame` loop with
  delta time (never frame counts — a 120 Hz phone and a 60 Hz laptop must spin identically).
  Ease-out spin, staggered per-reel stop, near-miss as visual rhythm only. HUD shows
  energy, credits, streak progress, and — always visible — "next break in N spins".
  Touch input with proper `pointer` events and no 300 ms delay.
- **Done when:** a spin resolves visually within 1.5 s, the animation is frame-rate
  independent, and the HUD never overlaps the reels at 320 px width.

### F4 — Ad layer *(the part that needs the audit to be final)*

- **Commit:** `feat: ad provider abstraction, aads.com adapter and break scheduler`
- **Files:** `src/ads/provider.ts`, `src/ads/aads.ts`, `src/ads/mock.ts`,
  `src/ads/cadence.ts`, `src/ui/break.ts`, `src/styles/break.css`,
  `test/cadence.test.ts`, `docs/ad-provider-audit.md`
- **Work:** see `docs/ad-provider-audit.md` for the verified capability matrix. The design
  is fixed regardless of what the audit finds: `AdProvider` exposes
  `load()`, `show(slot): Promise<AdResult>` and never exposes anything click-shaped.
  Energy is granted by an explicit, auditable rule in `cadence.ts`, never inside an ad
  callback that a click could influence.
- **Hard rule carried from the README:** an ad click must never grant, increment, or
  animate anything. No reward, no counter, no sound. This is not a style preference — it
  is invalid traffic under every network policy and it ends the account.
- **Done when:** `cadence.test.ts` proves the break fires on schedule, never during reel
  resolution, and that the energy grant is a pure function of elapsed ad time.

### F5 — Audio, haptics, progression

- **Commit:** `feat: synthesized audio, haptics, streaks, bonus rounds and autoplay`
- **Files:** `src/audio/sfx.ts`, `src/game/progression.ts`, `src/ui/autoplay.ts`,
  `test/progression.test.ts`
- **Work:** Web Audio API, fully synthesized — zero audio assets, zero licensing, zero
  network weight. `navigator.vibrate` for reel stops, guarded behind a user-gesture unlock
  and a capability check. Streaks break when they break. Autoplay stops on any touch
  anywhere and is never faster than a human could reasonably watch.
- **Done when:** no audio file exists in the repo, tests cover streak and bonus math, and
  a tap anywhere halts autoplay within one frame.

### F6 — Mobile-first finish

- **Commit:** `feat: mobile-first layout, safe areas and performance pass`
- **Files:** `src/styles/*.css`, `src/main.ts`, `src/ui/haptics.ts`
- **Work:** every breakpoint from 320 px up, verified at 320 / 360 / 390 / 430 / 768 /
  1280. Thumb-reachable controls on one-handed use. No horizontal scroll at any width.
  `env(safe-area-inset-*)` respected. Long-task fragmentation and layout-thrash pass.
- **Done when:** verified at all six widths with no overflow and no console errors.

### F7 — Metrics

- **Commit:** `feat: local metrics instrumentation`
- **Files:** `src/metrics.ts`, `docs/metrics.md`
- **Work:** privacy-respecting local counters only — sessions, spins per session, ad views
  per session, streak length. No fingerprinting, no cross-site identifiers, no PII, no
  third-party analytics. Export is a JSON string the player can read and delete.
- **Done when:** a full session produces a coherent metrics record and there is zero
  network traffic beyond the ad network.

### F8 — CI, deploy, budget

- **Commit:** `ci: deploy to gh-pages with typecheck, tests and size budget`
- **Files:** `.github/workflows/deploy.yml`, `.github/ISSUE_TEMPLATE/*`, `package.json`
- **Work:** single workflow — install with `npm ci`, `verify`, then deploy `dist/` to
  `gh-pages`. A size-budget step fails the build over 120 kB gzipped. Cache npm. Concurrency
  group so a second push cannot race a deploy.
- **Done when:** pushing to `master` produces a green run and a live `gh-pages` URL.

---

## 3. Sequenced dependency graph

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5 ──► F6 ──► F7 ──► F8
                 └─ pure, 100% tested, zero DOM
```

Nothing in F2 depends on anything above it. The entire game logic is testable before a
single pixel is drawn, which is the point of doing it in this order.

---

## 4. Explicitly deferred

| Item | Why deferred |
|---|---|
| PWA / offline / installable | needs stable asset pipeline first |
| Leaderboards | requires a backend and an account system — out of scope for a no-backend project |
| Native shell | platform decision is closed: web only |
| Any monetization beyond aads.com display/video | a single provider keeps the integration auditable |

---

## 5. Open items requiring input

| # | Question | Impact if unanswered |
|---|---|---|
| 1 | aads.com **publisher account ID / zone ID** — needed before F4 can load real ads | F4 ships with the mock adapter; ad revenue is zero until it lands |
| 2 | Target ad views per session | F4 cadence tuning; default 1 break per 5 spins |
| 3 | Whether leaderboards are ever wanted | F7 only |

---

## 6. Definition of done for the project

The game runs on a 320 px phone in a browser, a full session completes without a single
console error, `npm run verify` is green, the size budget holds, one push deploys it, and
no line of the code rewards an ad click.