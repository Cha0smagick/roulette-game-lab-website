import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDom, type InstalledDom } from './helpers/dom.js'

/**
 * The page entry is the one module the rest of the suite never executed.
 *
 * Every other module is pure or nearly pure and was tested directly, which left
 * the composition that a visitor actually loads untested. A thrown error in
 * `boot()` therefore shipped a page that sat on "Loading..." forever. These
 * tests run the real entry against a DOM stub so that failure mode is a red
 * test instead of a support ticket.
 */

let dom: InstalledDom

async function loadEntry(): Promise<void> {
  await import('../src/main.js')
}

describe('a page that cannot start', () => {
  beforeEach(() => {
    dom = installDom()
    vi.resetModules()
  })

  it('replaces the boot message with an explanation instead of hanging', async () => {
    const { boot } = await import('../src/ui/boot.js')

    boot('app', () => {
      throw new Error('the wheel refused to draw')
    })

    expect(dom.app.className).toContain('boot--failed')
    expect(dom.app.findByClass('boot__detail')?.textContent).toContain(
      'the wheel refused to draw',
    )
    // The frozen symptom was a permanent "Loading...", so its absence is the
    // assertion that matters here.
    expect(dom.app.findByClass('boot__msg')?.textContent).not.toContain('Loading')
  })

  it('still throws when the mount point is missing, because there is nowhere to explain', async () => {
    const { boot } = await import('../src/ui/boot.js')

    expect(() => boot('nothing-here', () => undefined)).toThrow(/nothing-here/)
  })
})

describe('the table page entry', () => {
  beforeEach(() => {
    dom = installDom()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('boots and replaces the boot message with the table', async () => {
    await loadEntry()

    expect(dom.app.className).not.toContain('boot')
    expect(dom.app.className).toBe('shell')
    expect(dom.app.findByTag('main').length).toBe(1)
  })

  it('mounts the wheel, the board and the controls', async () => {
    await loadEntry()

    expect(dom.app.findByClass('wheel')).not.toBeNull()
    expect(dom.app.findByClass('board')).not.toBeNull()
    expect(dom.app.findByClass('chips')).not.toBeNull()
    expect(dom.app.findByClass('controls__spin')).not.toBeNull()
    expect(dom.app.findByClass('adslot')).not.toBeNull()
  })

  // The table page carries two units (G9): an idle-gated one inside the table
  // section and a footer one. On arrival the idle one is deliberately `waiting`
  // — no advertisement before the player has done anything — and the footer one
  // is `live`. Both halves are asserted because asserting either alone would
  // pass just as well if the other had been forgotten entirely.
  it('mounts the footer unit live and holds the idle unit until the table is idle', async () => {
    await loadEntry()

    const slots = dom.app.findAllByClass('adslot')
    const byPlacement = new Map(slots.map((slot) => [slot.dataset['adslot-placement'], slot]))

    expect(slots).toHaveLength(2)
    expect(byPlacement.get('footer')?.dataset['adslot']).toBe('live')
    expect(byPlacement.get('idle')?.dataset['adslot']).toBe('waiting')
    expect(byPlacement.get('idle')?.findAllByClass('adslot__frame')[0]?.findByTag('iframe').length).toBe(0)
  })

  it('disables spin until there is a bet to spin', async () => {
    await loadEntry()

    const spin = dom.app.findByClass('controls__spin')
    expect(spin?.disabled).toBe(true)
  })

  it('arms a number on the first tap and takes the straight-up on the second', async () => {
    await loadEntry()

    const seventeen = dom.app
      .findAllByClass('board__number')
      .find((node) => node.textContent === '17')
    expect(seventeen).toBeDefined()

    // The board arms before it commits, because a single tap cannot be both
    // "straight-up on 17" and "half of a split with 16 or 18". One tap arms,
    // a second tap on the same number means the player meant the straight-up.
    seventeen?.click()
    expect(seventeen?.classList.contains('board__number--armed')).toBe(true)
    expect(dom.app.findByClass('controls__spin')?.disabled).toBe(true)

    seventeen?.click()
    expect(seventeen?.classList.contains('board__number--staked')).toBe(true)
    expect(dom.app.findByClass('controls__spin')?.disabled).toBe(false)
  })

  it('settles a spin and reports it in the live region', async () => {
    await loadEntry()

    const seventeen = dom.app
      .findAllByClass('board__number')
      .find((node) => node.textContent === '17')
    seventeen?.click()
    seventeen?.click()

    const spin = dom.app.findByClass('controls__spin')
    expect(spin?.disabled).toBe(false)
    spin?.click()

    const result = dom.app.findByClass('hud__result')
    expect(result?.textContent).not.toBe('')
    expect(result?.getAttribute('aria-live')).toBe('polite')
  })
})

/**
 * A DOM stub has no layout engine and no hit testing, so a simulated click on
 * "17" succeeds even when a real browser routes the tap to whatever paints on
 * top of it. That is exactly how the board shipped with the numbers
 * unreachable: the overlay layer sat over the grid with the street family armed
 * by default, every tap staked a street instead, and the staked overlay washed
 * brass across the whole row — which reads as "all the cells turned yellow".
 *
 * These tests therefore assert the structural invariant that makes the
 * interception impossible instead of replaying the taps.
 */
describe('the board never covers the numbers', () => {
  beforeEach(() => {
    dom = installDom()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  function overlays() {
    return dom.app.findAllByClass('board__overlay')
  }

  function liveOverlays() {
    return overlays().filter((node) => node.hidden === false)
  }

  function layerButton(id: string) {
    return dom.app
      .findAllByClass('board__layer')
      .find((node) => node.getAttribute('data-i18n') === `board.layer.${id}`)
  }

  function number(label: string) {
    return dom.app
      .findAllByClass('board__number')
      .find((node) => node.textContent === label)
  }

  it('opens with no overlay family armed, so a tap can only reach a number', async () => {
    await loadEntry()

    expect(liveOverlays()).toEqual([])
    expect(dom.app.findByClass('board__overlays')?.dataset['layer']).toBe('')
    expect(layerButton('numbers')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('hands the numbers back as soon as the numbers family is re-chosen', async () => {
    await loadEntry()

    layerButton('street')?.click()
    const streets = overlays().filter((node) =>
      node.classList.contains('board__overlay--street'),
    )
    // Derived rather than restated, so the count cannot drift with the geometry.
    expect(liveOverlays()).toHaveLength(streets.length)
    expect(dom.app.findByClass('board__overlays')?.dataset['layer']).toBe('street')

    layerButton('numbers')?.click()
    expect(liveOverlays()).toEqual([])
    expect(dom.app.findByClass('board__overlays')?.dataset['layer']).toBe('')
  })

  it('marks exactly one number when a straight-up is staked', async () => {
    await loadEntry()

    number('17')?.click()
    number('17')?.click()

    const staked = dom.app
      .findAllByClass('board__number')
      .filter((node) => node.classList.contains('board__number--staked'))
    expect(staked).toHaveLength(1)
    expect(staked[0]?.textContent).toBe('17')
  })

  it('keeps a staked overlay visible but out of the way once its family is disarmed', async () => {
    await loadEntry()

    layerButton('street')?.click()
    const firstStreet = overlays().find((node) =>
      node.classList.contains('board__overlay--street'),
    )
    expect(firstStreet?.hidden).toBe(false)
    firstStreet?.click()
    expect(firstStreet?.classList.contains('board__overlay--staked')).toBe(true)

    layerButton('numbers')?.click()

    // A chip the player cannot see is a bet they think they lost, so the
    // overlay stays painted. What must not survive is its hit target.
    expect(firstStreet?.hidden).toBe(false)
    expect(firstStreet?.dataset['armed']).toBe('false')
  })
})