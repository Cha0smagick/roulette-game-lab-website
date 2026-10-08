/**
 * aads.com (Anonymous Ads) web display unit — the only ad integration in REELAZO.
 *
 * Read this before changing anything in this file.
 *
 * aads.com does not offer a completion callback on the web. There is no
 * `onComplete`, no `onViewable`, no rewarded-video SDK for browsers, and no
 * way to learn how long, or whether, a visitor actually looked at the unit.
 * The web product is a passive iframe. The embed code is fixed markup that the
 * publisher pastes into the page:
 *
 *     <iframe data-aa='2457816' src='//acceptable.a-ads.com/2457816/?size=Adaptive' ...>
 *
 * Consequences, all of them deliberate:
 *
 *  1. There is NO provider interface to implement here. Inventing one with a
 *     `show()` that resolves on a timer would be fabricating an event that
 *     never happened, and any code built on it would be measuring our own
 *     guess rather than anything real. So `src/ads/provider.ts` deliberately
 *     exports no lifecycle.
 *
 *  2. The unit cannot grant, advance, animate or reward anything. It is a
 *     rectangle of foreign markup that the game never reads and never writes
 *     to. The incentive-to-click rule is therefore satisfied structurally
 *     rather than by vigilance: there is no code path from an ad event to
 *     game state, because there are no ad events.
 *
 *  3. The unit is mounted LAST, after the table is interactive, and it is
 *     contained so it can never cover the board or swallow a tap.
 *
 * Every function here is pure or builds a detached element. Nothing performs
 * a network request: the iframe's `src` is what loads, and it loads when the
 * element is inserted into the document by `src/ui/adslot.ts`.
 */

/** The publisher unit id supplied for this project. */
export const AADS_UNIT_ID = '2457816'

/** Sizes the aads.com web tag accepts. Adaptive is the one that fits any viewport. */
export const AADS_SIZES = ['Adaptive', 'Fixed', 'Skyscraper'] as const

export type AadsSize = (typeof AADS_SIZES)[number]

/**
 * Protocol-relative origin as published in the aads.com embed snippet.
 * Protocol-relative is correct here: the site is served over https on
 * GitHub Pages and the ad host supports both, so inheriting the page scheme
 * avoids a mixed-content block and a redirect.
 */
export const AADS_ORIGIN = '//acceptable.a-ads.com'

/**
 * The iframe `src` for a unit.
 *
 * Unit ids are digits on this network. Validating rather than interpolating
 * blind keeps a typo in a config file from silently producing a request to a
 * path we did not intend.
 */
export function aadsSrc(unitId: string, size: AadsSize): string {
  if (!/^\d+$/.test(unitId)) {
    throw new RangeError(`aads unit id must be digits, received ${unitId}`)
  }
  return `${AADS_ORIGIN}/${unitId}/?size=${size}`
}

export interface AadsUnit {
  readonly frame: HTMLIFrameElement
  readonly src: string
}

/**
 * Build the unit element, detached. It performs no request until inserted.
 *
 * `title=""` is intentional and is the accessible name, not missing metadata:
 * an empty title removes the iframe from the accessibility tree and from the
 * tab order, which is the correct treatment for opaque third-party advertising
 * that the page cannot describe or translate. The surrounding `<aside>` carries
 * the translated "Advertisement" label instead, so the region is still
 * announced as an ad — which is what the reader needs to know.
 */
export function createAadsUnit(unitId: string = AADS_UNIT_ID, size: AadsSize = 'Adaptive'): AadsUnit {
  const src = aadsSrc(unitId, size)
  const frame = document.createElement('iframe')
  frame.setAttribute('data-aa', unitId)
  frame.setAttribute('title', '')
  frame.setAttribute('loading', 'lazy')
  frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
  frame.setAttribute('allowtransparency', 'true')
  frame.setAttribute('scrolling', 'no')
  frame.src = src
  return { frame, src }
}

/**
 * Master switch for the whole integration.
 *
 * aads.com must approve the unit for the domain that serves it before it will
 * fill. Until that approval exists the site must still build, deploy and render
 * with the slot reserved but empty — flipping this to `false` produces exactly
 * that, and the reserved height is unchanged either way so no layout moves.
 */
export const AADS_ENABLED = true