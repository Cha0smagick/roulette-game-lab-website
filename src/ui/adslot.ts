/**
 * Advertisement slots.
 *
 * Three rules decide everything in this file, and each one exists because
 * breaking it costs the ad account rather than just impressions:
 *
 * 1. The height is reserved before the unit exists. An ad's intrinsic height is
 *    unknown until the network answers, so a slot that grows when it fills
 *    pushes the controls a player was reaching for somewhere else. On the table
 *    page that is a misdirected tap, which is a report and a lost session.
 *
 * 2. The unit cannot cover the page. The publisher's snippet carries
 *    `z-index: 99998`; the containment lives on the shared `.adslot__frame` in
 *    adslot.css rather than on any individual placement, so a placement added
 *    later cannot forget it.
 *
 * 3. Nothing here can be reached by an interaction with the ad. The unit is a
 *    cross-origin iframe that owns its own document: this module cannot see
 *    inside it, cannot observe a click on it, and exposes no callback one could
 *    arrive through. An ad interaction is structurally incapable of changing
 *    game state, which is the only honest form of "no accidental clicks".
 */
import { AADS_ENABLED, createAadsUnit } from '../ads/aads.js'
import { t } from '../i18n/index.js'

/**
 * The placements this module understands, exported so a page that passes an
 * unknown placement fails to compile rather than silently rendering a slot
 * with no unit in it.
 */
export const AD_PLACEMENTS = ['inline', 'footer', 'idle'] as const

export type AdPlacement = (typeof AD_PLACEMENTS)[number]

/**
 * `waiting` — the unit's placement allows it but the gate is not satisfied yet.
 * `empty`   — ads are switched off, or the unit has not been approved for this
 *             domain, so nothing is requested at all.
 * `live`    — the unit is in the document.
 */
export type AdSlotState = 'waiting' | 'empty' | 'live'

export interface AdSlot {
  readonly element: HTMLElement
  /**
   * Re-evaluates the gate. Cheap and idempotent: once the unit is in the
   * document this does nothing, so a caller may run it on every state change
   * without thinking about it.
   */
  sync(): void
}

export interface AdSlotOptions {
  readonly placement: AdPlacement
  /**
   * Only consulted for the `idle` placement. A slot that is idle-gated and has
   * no gate to consult waits forever rather than defaulting to live: taking a
   * page down over a misconfigured advertisement would be worse than earning
   * nothing from it, and the whole point of the gate is that an ad must never
   * appear under a finger.
   */
  readonly isIdle?: () => boolean
}

export function createAdSlot(options: AdSlotOptions): AdSlot {
  const frame = document.createElement('div')
  frame.className = 'adslot__frame'

  const element = document.createElement('aside')
  element.className = 'adslot'
  element.setAttribute('aria-label', t('ad.label'))
  element.dataset['adslot'] = 'waiting'
  element.dataset.adslotPlacement = options.placement
  element.append(frame)

  // One-way by design. Removing and re-adding the unit to follow the gate
  // would request the ad again on every transition, which reloads it and
  // destroys the viewability that sets its eCPM, while manufacturing
  // impressions nobody looked at.
  let inserted = false

  function sync(): void {
    if (inserted) return

    if (!AADS_ENABLED) {
      element.dataset['adslot'] = 'empty'
      inserted = true
      return
    }

    if (options.placement === 'idle') {
      const gate = options.isIdle
      if (gate === undefined || !gate()) return
    }

    const unit = createAadsUnit()
    frame.append(unit.frame)
    element.dataset['adslot'] = 'live'
    element.dataset.adslotSrc = unit.src
    inserted = true
  }

  return { element, sync }
}