# Ad provider audit — aads.com

Date of audit: 2026-10-07. Scope: the aads.com **web** product only, and only the
single display unit issued for this project (`2457816`).

## Summary

| Question | Answer |
| --- | --- |
| Does aads.com offer a rewarded / completion-callback format on the web? | **No.** There is no completion callback of any kind. |
| Can the game learn that an ad was viewed, or for how long? | **No.** No viewability event, no timer, no impression callback. |
| Can an ad interaction grant, advance or animate game state? | **No**, and this is now structurally impossible: no ad code can reach game state. |
| Does the unit load on the deployed https origin? | Yes. The embed host is protocol-relative, so the page scheme is inherited. |
| Must the unit be approved for the domain? | **Yes — and it has not been.** Until it is, the slot renders reserved-but-empty. |

## What aads.com actually gives you on the web

A publisher pastes this markup into the page. It is the whole integration:

```html
<!-- BEGIN AADS AD UNIT 2457816 -->
<div id="frame" style="width: 100%;margin: auto;position: relative; z-index: 99998;">
  <iframe data-aa='2457816' src='//acceptable.a-ads.com/2457816/?size=Adaptive'
    style='border:0; padding:0; width:70%; height:auto; overflow:hidden;display: block;margin: auto'></iframe>
</div>
<!-- END AADS AD UNIT 2457816 -->
```

Three properties of that snippet drove every decision in this phase:

1. **It is an iframe, not a script with an API.** There is no `window.aaads`,
   no `onComplete`, no `onViewable`. The page cannot observe the iframe's
   contents or its lifecycle. `src/ads/aads.ts` builds the iframe and stops
   there.
2. **There is no completion callback.** Consequently no provider lifecycle was
   implemented. An earlier draft of this project had an `AdProvider` interface
   with `load()`, `show()` and `AdResult { reason: 'completed' | 'unavailable'
   | 'error' }`. It was **deleted**, along with the mock provider and the
   break-cadence scheduler, because every one of those values would have been a
   fabrication: `completed` would have meant "a timer we own fired", not "the
   visitor watched something". A project whose central claim is honest
   arithmetic cannot open with a fake measurement.
3. **The wrapper div asks for `z-index: 99998`.** That is the network asking to
   float above the publisher's page. It is harmless in an article and
   unacceptable over a betting board, so the unit is mounted inside
   `.adslot__frame`, which pins its own stacking context at zero and applies
   `contain: paint`. `contain: paint` gives the iframe no box to paint outside
   of, which is stronger than winning a z-index contest: markup we do not
   control cannot raise itself over the table regardless of what it sets on its
   own elements.

## The incentive-to-click rule

The rule in this project has always been: **nothing about an ad may ever grant,
increment or animate anything the player sees.** It was originally enforced by
vigilance — an `AdProvider` interface that exposed no click-shaped member, and a
cadence module that granted its reward on a rule written outside any ad
callback.

It is now enforced by **absence of code**:

- `src/game/**` and `src/roulette/**` import nothing from `src/ads/**`
  (asserted by `test/ads.test.ts`).
- No module under `src/ads/**` contains the string "click" in any case form
  (asserted).
- No module under `src/ads/**` exports a `load` or `show` lifecycle the game
  could await (asserted).

There is no ad event for the game to reward, so there is nothing to reward. The
three assertions above fail the build if that ever stops being true, which makes
this rule stronger than the comment it replaced.

## Mounting order and layout stability

- The unit is mounted **after the table is interactive**, from `mount()` in
  `src/ui/adslot.ts`. An ad that loads before the game is playable makes a
  first-time visitor bounce before they learn what the site is.
- The slot reserves its height up front (`min-height: 90px` on both the slot and
  the frame), so filling it cannot move the footer. On a single-column mobile
  layout, a jump below the fold moves content the player is reading.
- The iframe is `loading="lazy"` and capped at `max-width: 728px`, so a wide
  unit cannot dominate a 320 px screen.

## Open item

**The unit must be approved by aads.com for the domain that serves it before it
will fill.** `AADS_ENABLED` in `src/ads/aads.ts` is the switch. It is currently
`true`, and the site renders correctly with the slot reserved but empty until
approval lands — flipping the switch changes nothing visually, which is the
point: enabling the unit must not move a pixel.

Revenue is zero until that approval exists. Nothing else blocks the deploy.

## Rejected alternatives

| Considered | Why not |
| --- | --- |
| Fake a completion event with a timer | Reports our guess as a measurement. Unacceptable in a project whose claim is derived, not asserted. |
| Wrap the unit and detect clicks via `window.blur` / visibility | Reading whether a click *left* the page still requires rewarding it, which is incentivized clicking. Also unmeasurable. |
| Add a second network with a real completion callback | The only such products are mobile app SDKs. A native shell is out of scope. |
| Let the ad cover the page, network style, and rely on the player scrolling past | The player is mid-bet on a 320 px screen. A misclick on an ad is a misclick away from a bet. |