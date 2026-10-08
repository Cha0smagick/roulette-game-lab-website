# REELAZO

[![Deploy](https://github.com/Cha0smagick/Ads-Bet-an-ads-game/actions/workflows/deploy.yml/badge.svg)](https://cha0smagick.github.io/Ads-Bet-an-ads-game/)

**Live site: <https://cha0smagick.github.io/Ads-Bet-an-ads-game/>**

A roulette analysis engine for the browser. Three pages, no backend, no accounts,
no money — and no predictions, because a wheel is a physical random process and
nothing predicts one.

The engine exists to do the one thing most gambling sites are built not to do:
state the arithmetic plainly and let you check it. Every house edge on this site
is **derived by enumerating the pockets of a wheel**, not copied from a table
someone else wrote. Every strategy verdict on this site comes from **running the
strategy**, not from an opinion about it.

---

## The three pages

| Page | What it does |
| --- | --- |
| **Live table** (`index.html`) | A playable European wheel. Bet on straight-ups, splits, streets, corners, six-lines, dozens, columns and the even-money outside bets. Every spin is reproducible from the seed printed on screen. |
| **Simulator** (`simulator.html`) | Runs several betting systems side by side over hundreds of thousands of spins and charts what actually happened: equity curves, final bankroll, expected value per spin, return on investment, maximum drawdown, and whether the bankroll was ruined and on which spin. Runs in a Web Worker, so the page stays responsive. |
| **Encyclopedia** (`encyclopedia.html`) | The arithmetic, written out: the three wheels, the fourteen bets, where the house edge comes from, what progression systems do and do not change, and why streaks do not mean what people think they mean. Its tables are generated from the same engine that runs the table, so they cannot drift out of date. |

---

## The house edge, derived

The European wheel has 37 pockets: 18 red, 18 black, and one green zero. Betting
red wins on 18 of them and loses on 19, so the edge is **1/37 = 2.70 %**. The
American wheel's two green pockets make it 18 against 20, so **1/38 = 5.26 %**.
A 36-pocket wheel with no zero has 18 against 18, so the edge is **exactly zero**.

That last case is the interesting one. It is also the proof that this engine is
not simply rigged against the player: the same code that charges 5.26 % on the
American wheel charges nothing at all on the fair one. Both are asserted to
twelve decimal places in the test suite, and so is the theorem that *every* bet
on a wheel shares that wheel's edge — a straight-up, a split, a corner, a column
and a bet on red all lose at exactly the same rate.

Run eight betting systems for 300 000 spins each on the unfair wheel and every
one of them loses. Run them on the fair wheel and the average is
indistinguishable from zero. Both directions are asserted, because either one
on its own would be consistent with an engine that is merely broken.

---

## What this project will not do

These are not aspirations. They are rules, and several of them are enforced by
tests that fail the build if a change breaks them.

- **No real money.** No deposits, no withdrawals, no wallets, no crypto, no
  cash-out, no "test your luck". The bankroll is 1 000 units that the site
  invented and that nobody can withdraw.
- **No compulsion mechanics.** No mechanic whose design purpose is to make
  someone unable to stop. No fake timers, no fake scarcity, no near-misses
  dressed up as wins, no manipulation of streaks.
- **No dishonest odds.** Every payout is published on the page, the house edge
  is computed from the pockets rather than asserted, and no bet pays less than
  the page says it pays.
- **No ad click that does anything.** See below.
- **No tracking of a player's state or habits.** No analytics, no fingerprinting,
  no personal data collected. The seed of your session stays in your browser.

A pull request that adds any of the above will be declined. The reasoning is in
`.github/pull_request_template.md`.

---

## The ad rule

The site carries one passive display unit from **aads.com**, in a reserved slot
below the game. The unit is an iframe the site does not control and cannot read.

**No code path exists in which an ad interaction grants, increments or animates
anything.** This is not a preference — rewarding a click is *incentivized
traffic*, the pattern every ad network's fraud systems are built to detect, and
the penalty is suspension plus withholding of money already earned. Since ad
revenue is the only revenue here, one such line of code would end the project.

That rule is enforced structurally in `test/ads.test.ts`, which fails the build
if any module under `src/ads` grows click handling, if any module under
`src/game` or `src/roulette` imports anything from `src/ads`, or if anything
re-introduces an ad lifecycle the game could await. A test that fails is a real
boundary; a comment is not. The full analysis is in
[`docs/ad-provider-audit.md`](docs/ad-provider-audit.md).

**The unit does not currently earn anything.** It has to be approved for this
domain by aads.com first, and that approval has not landed. Until it does, the
slot renders empty and `AADS_ENABLED` in `src/ads/aads.ts` is the switch.

---

## Stack

No framework. That is a deliberate trade: a framework would roughly double the
bundle, and bundle size is the one number that decides whether someone on a
phone finishes loading or leaves.

- **TypeScript, strict**, with `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `noImplicitReturns`
- **Vite**, three HTML entries, no client router — the browser's own navigation,
  reload, bookmark and back button work
- **Canvas 2D** for the wheel and the charts; no charting dependency
- **Web Worker** for batch simulation
- **Typed i18n**: the English dictionary is the source of truth and the
  `TranslationKey` type is derived from its shape, so a missing translation is a
  compile error. Adding German is one dictionary file and one registry entry.
- **CSS custom properties** as the design token layer, with a test that reads
  them back out of `base.css` and compares them against the canvas renderer's
  palette. That test exists because the wheel was once drawing a brass rim from
  a slightly different gold than the spin button used, and nothing in CSS and
  canvas shares a channel that would have noticed.
- **GitHub Actions** to GitHub Pages

## Running it

```sh
npm ci
npm run dev       # http://localhost:5173
npm run verify    # typecheck + tests + build. Must be green before every commit.
npm run size      # gzipped bundle budget
```

The site is three static files deep and needs nothing else. No backend, no
database, no environment variables.

### Deploying

Pushing to `main` runs the **Deploy** workflow, which is four gates in order:
`npm ci`, then `npm run verify`, then the gzipped size budget, then publish. Any
of the first three failing stops the deploy, so a red test never becomes a live
site and a bundle that grew past the budget never reaches a phone.

Two things are worth knowing because neither is visible from the code.

**Pages is configured to GitHub Actions, not to a branch.** That setting lives in
the repository settings, not in the repository. It is also the half of the
arrangement that fails quietly: pointed at a branch, the workflow goes green and
then cannot publish, and the error does not name the cause. If a push succeeds and
the site does not change, check that first.

**The build uses a relative `base`.** `base: './'` in `vite.config.ts` means every
asset reference is relative, which is what lets the same build work under a
project subpath like `/Ads-Bet-an-ads-game/` with no change. A single-slash base
would have broken every route and every chunk fetch the moment the site was
served from anything other than a domain root.

## Size budget

`npm run size` gzips every file in `dist/` and fails over **120 kB total**. The
site currently sits at about **34 kB**, so there is roughly four times headroom.
The budget measures the whole output — all three pages, every chunk, the worker —
because what a visitor downloads is the sum, and a budget that only looked at one
entry point would let a 90 kB script walk past it unnoticed.

## Accessibility and mobile notes

- Every control is a real `<button>`, at least 44 px, reachable by keyboard
- The current page is marked twice: with colour, and with `aria-current` — which
  is the one a screen reader actually reads
- The result of a spin is announced through a polite live region
- `prefers-reduced-motion` removes the wheel spin entirely; the same number is
  still drawn, and the table state is identical
- No page pins zoom. Pinning it breaks WCAG 1.4.4 and a test asserts it is absent
- Safe-area insets on all four edges, and `100dvh` rather than `100vh` so mobile
  Safari does not cut the footer off

## Tests

Roughly two hundred, and a good number of them exist because they caught
something. Notable ones:

- House edge derived and asserted to twelve decimal places, per wheel, per bet
- The double-zero modelled correctly (it shares the value `0` and is distinguished
  by position, which is why iterating the pockets meets `0` twice)
- Settle arithmetic shared between the live table and the simulator, so they
  cannot disagree about what a bet pays
- Every planned bet from every strategy is legal and covers at least one pocket
- The no-system-beats-the-zero theorem, in both directions described above
- Design system: tokens exist, canvas matches tokens, no stylesheet hardcodes a
  colour the tokens own, no viewport meta pins zoom, no layout declares a fixed
  width over 320 px
- Ad boundary: no click-shaped API, no import of the ad module from game code
- A copy guard that fails the build on hardcoded user-visible strings, so copy
  cannot silently ship in one language

## Status and honest gaps

- **Visual QA has not been done.** The site is published and nobody has opened it
  in a real browser at any viewport. The responsive work so far is a static audit
  of the CSS and HTML — viewport meta, fixed widths, safe areas, touch targets —
  which is a real check of a real class of bug and is not the same as looking at
  it. If something looks wrong on a phone, that is the least surprising thing
  about this project and the bug report template asks for the viewport for
  exactly that reason.
- **The ad unit is not approved for this domain yet**, so ad revenue is zero.
- The encyclopedia covers the arithmetic, not the folklore. There is no history
  of the game, no biographies, no casino-culture writing.

## Contributing

Read [`PLAN.md`](PLAN.md) first — it is the phase ledger and the reasoning
behind the architecture, including the places where what was built differs from
what was planned and why.

Every rule in the ground-rules section of that plan is checked by something
automated. If your change needs a test to be taken seriously, write the test.

## License

MIT. See [LICENSE](LICENSE).