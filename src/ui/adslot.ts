import { t } from '../i18n/index.js'
import { AADS_ENABLED, createAadsUnit } from '../ads/aads.js'

export interface AdSlot {
  readonly element: HTMLElement
  /** Inserts the unit. Safe to call once; later calls are ignored. */
  mount(): void
}

/**
 * The advertisement slot.
 *
 * Two rules are load-bearing here and both are enforced by the structure rather
 * than by discipline at the call site.
 *
 * 1. The height is reserved before the unit exists, so filling the slot cannot
 *    shift the layout under a player who is mid-bet. A layout jump is jank, and
 *    on a table of this size it is also a misclick: the bet a player aimed at
 *    is no longer under their thumb.
 *
 * 2. The unit can never cover the board or intercept a tap intended for it. The
 *    published aads.com snippet wraps its iframe in a div carrying
 *    `z-index: 99998` so the ad floats above whatever the publisher built. That
 *    is fine for a blog post and unacceptable over a betting board, so the unit
 *    is mounted inside a wrapper that pins its own stacking context at zero and
 *    clips paint. An ad served from a domain we do not control cannot raise
 *    itself above its container no matter what z-index it sets on its own
 *    children, because `contain: paint` gives it no room to paint outside.
 *
 * The unit is mounted by the caller only after the table is interactive, which
 * is the one ordering requirement here: an ad that loads before the game is
 * playable makes a first-time visitor bounce before they learn what the site
 * is.
 */
export function createAdSlot(): AdSlot {
  const slot = document.createElement('aside')
  slot.className = 'adslot'
  slot.setAttribute('aria-label', t('ad.label'))

  const frame = document.createElement('div')
  frame.className = 'adslot__frame'
  slot.append(frame)

  let mounted = false

  return {
    element: slot,

    mount(): void {
      if (mounted) {
        return
      }
      mounted = true

      if (!AADS_ENABLED) {
        // The unit is not approved for this domain yet. The slot keeps its
        // reserved height so enabling it later changes nothing visually.
        slot.dataset['adslot'] = 'empty'
        return
      }

      const unit = createAadsUnit()
      frame.append(unit.frame)
      slot.dataset['adslot'] = 'live'
      slot.dataset['adslotSrc'] = unit.src
    },
  }
}