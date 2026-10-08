# Slot Machine — the ad break IS the game

> A mobile-web slot machine where advertising is not the monetization layer.
> It is the resource. You cannot spin without it.

---

## 1. What this actually is

Not "a casino game that shows ads." **A slot machine whose only fuel is ad views.**

The reels are not bought with money. They are not bought with a daily gift. They are
powered by *ads the player watches*. Every spin consumes ad energy. When you run dry,
you must sit through a commercial break to play again.

That inverts the usual free-to-play structure:

| | Typical ad-supported game | This one |
|---|---|---|
| Ads | tax on the player, shown at convenience | **the cost of playing** |
| Player goal | avoid ads | **get enough ad time to spin** |
| Ad metric | impressions you tolerate | **watch time you need** |
| Retention serves | the ads | the ads — directly, in the loop |

The commercial break is not an interruption. It is the pump.

---

## 2. THE RULE — non-negotiable, this is what kills the account

**Never reward the player for clicking an ad.**

Not once, not partially, not "just the first click."

Why, mechanically:

- AdSense and AdMob classify *incentivized clicking* as invalid traffic. The rule is
  written into both ad placement policies and invalid traffic policies.
- Their fraud systems correlate **ad click events against app state changes**. A click
  that immediately increments a counter is a labelled pattern. It does not take a
  sophisticated attacker to trip it.
- Penalty is not a warning. It is account suspension and **withholding of money already
  earned**. Your revenue goes to zero and does not come back.

So the mechanic is:

- Player **watches** an ad, completion callback fires, energy granted.
- Player **clicks** the ad: nothing happens. No reward, no counter, no sound, no feedback.

The distinction is invisible to the player (they cannot tell there *should* have been a
reward) and fatal to the account if you get it wrong. This is the single highest-risk
line in the whole project.

### Also out — these get you banned or sued

- Fake ad players, hidden iframe impressions, traffic bought from click farms.
- Incentivizing *any* outbound click, including "open to claim your prize."
- Cloaking, rotating ad unit IDs, or hiding ads from the network's own scanner.
- Rewarding artificial watch time (rewarding *more* the longer the player stares at
  nothing is fabrication; a flat reward on completion is fine).

---

## 3. Stack reality — read this before designing features

You want GitHub Pages. GitHub Pages is static web. On static web:

| Ad format | Available? | Consequence |
|---|---|---|
| Display banner (AdSense) | yes | low eCPM, low engagement, no completion event |
| Video overlay (outstream / in-article) | yes | full view is player-controlled, **no reliable completion callback** |
| Rewarded video | **NO** | mobile app SDK only |
| Rewarded interactive | **NO** | mobile app SDK only |
| Playable ad (IAB standard) | **NO** | mobile app SDK only |
| Native ad | partially | manual reporting, low eCPM |

**So the literal version of the idea — where a playable ad unit *is* the micro-game
you play to unlock the reel spin — cannot be built on GitHub Pages.** It requires a
native app shell (Capacitor/TWA + AdMob or AppLovin).

This project builds the version that works on the platform chosen. If the playable unit
becomes the goal, the platform decision has to change first.

---

## 4. The loop

```
   ┌──────────────────────────────────────────────┐
   │                                              │
   ▼                                              │
 energy? ──no──► COMMERCIAL BREAK (telegraphed)  │
   │                │                             │
   │                ▼                             │
   │        video plays to completion             │
   │                │                             │
   │                ▼                             │
   │          energy += E                         │
   │                │                             │
   ▼                │                             │
 SPIN ──────────────┘                             │
   │                                              │
   ▼                                              │
 reels resolve → paytable outcome → visual rhythm │
   │                                              │
   ▼                                              │
 payout / near-miss / bonus round                │
   │                                              │
   └──────────────────────────────────────────────┘
```

Design rules for the break:

- **Telegraphed, never sprung.** A visible counter and a clear "next break in N spins."
  Surprising the player with an ad is the fastest way to lose them. It also risks
  accidental clicks, which is the *other* thing AdSense forbids.
- **Fixed cadence, fixed length.** Not every spin. Every 4–6 spins, plus at session end.
  Variable timing trains the player to hunt for the trigger and force it early.
- **No ad during resolution.** Never during a spin animation, a bonus round, or any
  moment the player needs to act. That produces accidental clicks.
- **Skip is not offered.** Skippable video reduces completion rate, which lowers eCPM,
  which lowers revenue. The break is the product.

---

## 5. The casino layer, applied to this

The casino surface is real and gets built properly. What it is *powered by* is the
change.

| Casino element | Implementation |
|---|---|
| Reels / spin | 3-reel, weighted paytable, published in-app |
| Bet size | 1–3 energy units per spin (risk selector) |
| Near-miss | visual rhythm only — never implies odds that do not exist |
| Streak | visible progress bar, breaks when it breaks |
| Bonus round | triggered by reel outcome, awards energy multiplier |
| Jackpot | progressive, seeded from a fixed house budget, visibly bounded |
| Wild / scatter | standard mechanics, fixed probabilities |
| Autoplay | exists, and it exists *because* autoplay = more spins = more impressions |

Autoplay is the growth engine and it is worth saying so plainly: the design goal for
retention and the design goal for ad inventory are the same number. A player on a long
autoplay streak is simultaneously earning impressions and staying in the game. That
alignment is the entire business.

---

## 6. Why this earns

Rewarded-video eCPM on mobile sits far above display-banner eCPM — typically an order of
magnitude — because advertisers pay for *completed attention*, not for a pixel. The web
formats are weaker per impression but the loop multiplies impressions:

- Slot session = 40–120 spins.
- 1 commercial break per 4–6 spins → **10–25 ad views per session**.
- Autoplay sessions push toward 300+ ad views per day for a heavy user.

Two honest caveats:

- **On web you are on display/outstream eCPM, not rewarded eCPM.** The loop compensates
  with volume, not per-view price.
- **Raw ad volume is not the goal.** Aggressive breaks reduce session length and
  retention, which reduces *total* impressions. Overstuffed breaks make more money per
  user per minute and less money per user per month. Cadence tuning is the whole game.

---

## 7. What this project does not include

Non-negotiable, stated up front so it is never a surprise later:

- No deposits, withdrawals, wallets, balances, or any real-money mechanism.
- No cryptocurrency, no on-chain anything, no wallet connection.
- No "test your luck," no deposit bonus, no cash-out, no near-cash-out language.
- No odds engineered to maximize player loss. The paytable is real and visible.
- No mechanic whose design purpose is making a player unable to stop.
- No streak-loss protection disguised as generosity, no fake scarcity, no fake timers,
  no dark patterns, no countdown that is not actually counting down.
- No tracking of a player's mental state, habits, or wellbeing.

Any pull request adding any of the above will be rejected. This is not negotiable and
does not need a discussion in review.

---

## 8. Tech

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict: true` | catch state bugs at compile time |
| Build | Vite | fast, tiny output, zero config |
| Framework | **none** | a mobile web game on GitHub Pages is judged on first-load time; every kB of framework is abandonment, and abandonment is lost impressions |
| Reels | Canvas 2D | full control over animation timing, no DOM thrash |
| Layout / depth | CSS 3D transforms | cheap, GPU-composited |
| Audio | Web Audio API, synthesized | zero asset weight, zero licensing |
| State | typed store + reducer | single source of truth, replayable |
| Persistence | `localStorage` | no backend, no account, no PII |
| Ads | Google AdSense | only workable web option |
| Deploy | GitHub Actions → `gh-pages` | one push, done |

Budget: **under 120 kB gzipped total**, including the game. Revisit that budget every
time something is added.

---

## 9. Structure

```
index.html
src/
  main.ts              bootstrap
  game/
    state.ts           typed state, reducer
    energy.ts          ad-energy accounting
    spin.ts            spin resolution + weighting
    paytable.ts        the published table
    progression.ts     streaks, bonus, jackpot
  ui/
    reel.ts            canvas reel renderer
    hud.ts             energy, credits, progress
    break.ts           commercial-break sequence
    overlays.ts        menus, paytable, settings
  ads/
    provider.ts        ad network adapter (one interface, one impl)
    cadence.ts         break scheduling + telegraphing
  audio/
    sfx.ts             synthesized sound
  util/
    storage.ts         safe localStorage
    rng.ts             seeded PRNG
docs/
  ad-policy.md         network rules this project must not break
  metrics.md           what gets measured and why
```

---

## 10. What gets measured

Priority order. Retention first, always.

1. **D1 / D7 retention** — does anyone come back
2. **sessions per user per day**
3. **average session length (spins)**
4. **ad views per session** (cadence tuning knob)
5. **fill rate and eCPM** (ad revenue reality)

If (4) and (5) are high but (1) is low, the game is bad and the numbers are hiding it.
High impressions from unhappy players is not a business, it is a churn curve.

---

## 11. Roadmap

| Phase | Deliverable |
|---|---|
| F0 | Vite + TS strict scaffold, GitHub Actions deploy to `gh-pages` |
| F1 | Canvas reels, weighted spin, published paytable, seeded RNG |
| F2 | Energy economy + cadence scheduler + break sequence + ad provider |
| F3 | Audio, progression, bonus rounds, autoplay |
| F4 | Mobile-first layout, safe areas, haptics, performance pass |
| F5 | Metrics instrumentation |
| F6 | PWA / offline / installable |

---

## 12. Open decisions

| # | Question | Blocks |
|---|---|---|
| 1 | AdSense only, or is a native app acceptable? | F2 — determines whether playable ads are ever in scope |
| 2 | Brand name | F4 |
| 3 | Break cadence target: how many ad views per session is the goal? | F2 tuning |
| 4 | Single-player only, or leaderboards? | F5 — leaderboards imply backend and accounts |

---

## License

MIT.

## Contributing

Contributions welcome. Pull requests that add real-money mechanics, cryptocurrency,
incentivized ad clicking, or compulsion-by-design mechanics are rejected on sight and
the discussion will not be reopened.