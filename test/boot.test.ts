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

  it('leaves the ad slot empty until it is mounted, then live', async () => {
    await loadEntry()

    const slot = dom.app.findByClass('adslot')
    expect(slot).not.toBeNull()
    expect(slot?.dataset['adslot']).toBe('live')
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