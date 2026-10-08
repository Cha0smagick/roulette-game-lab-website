<!--
  Kept short on purpose. A long template gets skimmed, and the one rule below is
  the only thing here that cannot be worked around by a well-intentioned
  contributor.
-->

## What this changes

<!-- One or two sentences. What is different after this merges. -->

## Why

<!-- The problem, not the solution. -->

## How it was checked

- [ ] `npm run verify` is green (typecheck, tests, build)
- [ ] `npm run size` is green, and if the bundle grew, the growth is intentional and named in the description
- [ ] New user-visible copy exists as a key in **both** `src/i18n/locales/en.ts` and `src/i18n/locales/es.ts`
- [ ] Every number this touches is computed by a test rather than restated in a comment or in prose
- [ ] Anything new that a user can tap is a real `<button>`, reaches 44 px, and works from the keyboard

### The four things this project will not merge

Real-money gambling, in any form. Deposits, withdrawals, wallets, crypto, cash-out
mechanics, "test your luck", bonus-withdrawal conditions.

Mechanics whose purpose is to make someone unable to stop. Fake timers, fake
scarcity, near-misses dressed as wins, streak-loss manipulation, anything that
tracks a player's state or habits.

Odds that are worse than they look. A bet that pays less than the page says it
pays, or a wheel whose edge is not the one the encyclopedia prints.

Anything an ad click can cause. No code path in which an ad interaction grants,
increments or animates anything. `test/ads.test.ts` enforces this structurally
and will fail the build if that changes.

### What to do instead

If the honest version of the idea does not sound interesting enough to build,
that is useful information and worth saying plainly in the description. A
declined PR with a clear reason is cheaper than one merged and regretted.