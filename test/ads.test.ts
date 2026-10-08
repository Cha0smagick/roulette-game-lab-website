import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

import { AADS_ENABLED, AADS_ORIGIN, AADS_SIZES, AADS_UNIT_ID, aadsSrc } from '../src/ads/aads.js'
import { AD_PLACEMENTS, type AdSlot, type AdSlotOptions } from '../src/ui/adslot.js'
import { installDom, type StubElement } from './helpers/dom.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Every .ts file under a repo-relative directory, recursively. */
function sourcesIn(dir: string): readonly string[] {
  const base = join(ROOT, dir)
  const out: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.ts')) {
        out.push(full)
      }
    }
  }
  walk(base)
  return out
}

function readRepo(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8')
}

/**
 * Drops comments so a structural assertion can look at code only. Without this
 * the assertions below would flag the prose that explains WHY there is no click
 * handling, which is exactly the prose we want to keep.
 *
 * The line-comment pass is deliberately crude: it only treats `//` as a comment
 * when the preceding character is not a colon, so a protocol-relative origin
 * such as '//acceptable.a-ads.com' is not truncated mid-string. A full parser
 * would be the real answer; this is enough to keep the guard honest for the
 * patterns it checks, and the risk of it hiding a real handler is noted rather
 * than papered over.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('aads unit identity', () => {
  it('pins the publisher unit this project was issued', () => {
    // If a unit is ever reissued this assertion is the thing that must change
    // on purpose, alongside the audit doc, rather than by quiet substitution.
    expect(AADS_UNIT_ID).toBe('2457816')
  })

  it('builds the published embed src', () => {
    expect(aadsSrc(AADS_UNIT_ID, 'Adaptive')).toBe('//acceptable.a-ads.com/2457816/?size=Adaptive')
  })

  it('keeps the ad host protocol-relative', () => {
    // Hardcoding https would break a plain-http preview; hardcoding http would
    // be blocked as mixed content on the deployed origin.
    expect(AADS_ORIGIN).toBe('//acceptable.a-ads.com')
  })

  it('exposes only the sizes the tag documents', () => {
    expect([...AADS_SIZES]).toEqual(['Adaptive', 'Fixed', 'Skyscraper'])
  })

  it('is enabled', () => {
    expect(AADS_ENABLED).toBe(true)
  })
})

describe('aads unit identifier validation', () => {
  it('rejects anything that is not a bare digit run', () => {
    for (const bad of ['', '2457816/../x', 'abc', '2457816?size=x', '2457816 ', '../1']) {
      expect(() => aadsSrc(bad, 'Adaptive')).toThrow(RangeError)
    }
  })

  it('accepts the unit id', () => {
    expect(() => aadsSrc(AADS_UNIT_ID, 'Adaptive')).not.toThrow()
  })
})

describe('the incentive-to-click rule is enforced structurally', () => {
  // The published aads.com web tag has no completion callback, no viewability
  // event and no rewarded format for browsers. There is therefore no ad event
  // the game could listen to, which is why the rule below holds by absence of
  // code rather than by a promise in a comment.

  it('no game module imports from the ads directory', () => {
    const offenders: string[] = []
    for (const dir of ['src/game', 'src/roulette']) {
      for (const file of sourcesIn(dir)) {
        const source = readFileSync(file, 'utf8')
        if (/from\s+['"][^'"]*ads\//.test(source)) {
          offenders.push(relative(ROOT, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no ads module handles a click in its code', () => {
    const offenders: string[] = []
    for (const file of sourcesIn('src/ads')) {
      if (/click/i.test(stripComments(readFileSync(file, 'utf8')))) {
        offenders.push(relative(ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('no ads module exports a lifecycle the game could await', () => {
    // A `show()` that resolves on a timer would fabricate an event that never
    // happened, and every number computed from it would be a guess presented
    // as a measurement.
    const offenders: string[] = []
    for (const file of sourcesIn('src/ads')) {
      if (
        /export\s+(async\s+)?function\s+(show|load)\b/.test(
          stripComments(readFileSync(file, 'utf8')),
        )
      ) {
        offenders.push(relative(ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('the audit document records that there is no completion callback', () => {
    const audit = readRepo('docs/ad-provider-audit.md')
    expect(audit).toMatch(/no completion callback/i)
    expect(audit).toMatch(/incentivized clicking/i)
  })
})

describe('the ad cannot cover the table', () => {
  it('the frame pins its own stacking context at zero', () => {
    // The published snippet asks for z-index 99998. If this ever stops being
    // zero the ad wins the fight against the board.
    expect(readRepo('src/styles/adslot.css')).toMatch(/z-index:\s*0\b/)
  })

  it('the frame clips paint so a foreign z-index has nowhere to go', () => {
    expect(readRepo('src/styles/adslot.css')).toMatch(/contain:\s*paint/)
  })

  it('the slot reserves its height before the unit exists', () => {
    const css = readRepo('src/styles/adslot.css')
    const reservations = css.match(/min-height:\s*90px/g) ?? []
    expect(reservations.length).toBeGreaterThanOrEqual(2)
  })
})

describe('the slot mounts only what it was asked to', () => {
  it('main.ts no longer builds the slot inline', () => {
    // The old inline builder reserved height and nothing else. Keeping the
    // slot in its own module is what allows it to be tested and to have the
    // containment guarantees above attached to it.
    expect(readRepo('src/main.ts')).not.toMatch(/function buildAdSlot/)
  })
})

/**
 * G9: an idle-gated unit and the placements. These are the only assertions here
 * that need a DOM, because the gate is the one behaviour that cannot be read
 * out of the source — a slot that looks correct in the file can still insert the
 * unit on the first frame and put an advertisement under a thumb that is on its
 * way to a chip.
 */
describe('the idle gate decides when the unit is allowed to exist', () => {
  // Installed for its side effect: it puts `document` and `localStorage` on the
  // globalThis, which the ad slot and the i18n module both read at import time.
  // Nothing here inspects the returned tree, so nothing keeps a handle on it.
  beforeEach(() => {
    installDom()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  /** Loaded dynamically: adslot.ts imports i18n, which resolves a locale at module scope. */
  async function newSlot(options: AdSlotOptions): Promise<AdSlot> {
    const { createAdSlot } = await import('../src/ui/adslot.js')
    return createAdSlot(options)
  }

  function frames(slot: AdSlot): unknown[] {
    return (slot.element as unknown as StubElement).findAllByClass('adslot__frame')
  }

  function iframes(slot: AdSlot): unknown[] {
    return frames(slot).flatMap((frame) =>
      (frame as unknown as StubElement).findByTag('iframe'),
    )
  }

  it('requests nothing at all while the gate is closed', async () => {
    const slot = await newSlot({ placement: 'idle', isIdle: () => false })
    slot.sync()
    slot.sync()

    expect(slot.element.dataset['adslot']).toBe('waiting')
    // Zero iframes, not one: a unit inserted then hidden is still a request the
    // network answered, which is an impression nobody looked at.
    expect(iframes(slot)).toHaveLength(0)
  })

  it('inserts exactly one unit the first time the gate opens', async () => {
    let idle = false
    const slot = await newSlot({ placement: 'idle', isIdle: () => idle })

    slot.sync()
    expect(iframes(slot)).toHaveLength(0)

    idle = true
    slot.sync()
    expect(slot.element.dataset['adslot']).toBe('live')
    expect(iframes(slot)).toHaveLength(1)
  })

  it('never removes a unit it has already inserted', async () => {
    // One-way on purpose. Removing and re-adding on every busy/idle transition
    // would re-request the ad each time, which reloads it, destroys the
    // viewability that sets its eCPM, and manufactures impressions nobody saw.
    let idle = true
    const slot = await newSlot({ placement: 'idle', isIdle: () => idle })

    slot.sync()
    expect(iframes(slot)).toHaveLength(1)

    idle = false
    slot.sync()
    slot.sync()

    expect(slot.element.dataset['adslot']).toBe('live')
    expect(iframes(slot)).toHaveLength(1)
  })

  it('waits forever when an idle unit is given no gate to consult', async () => {
    // Fail closed. A misconfigured advertisement must never be the reason a page
    // shows an ad under a finger, and it must never take the page down either —
    // so it earns nothing and breaks nothing.
    const slot = await newSlot({ placement: 'idle' })
    slot.sync()

    expect(slot.element.dataset['adslot']).toBe('waiting')
    expect(iframes(slot)).toHaveLength(0)
  })

  it('mounts an ungated placement on the first sync', async () => {
    // The gate is the idle placement's alone. A footer unit has nothing to wait
    // for, and a gate it never consults would look like a bug.
    for (const placement of ['inline', 'footer'] as const) {
      const slot = await newSlot({ placement })
      slot.sync()
      expect(slot.element.dataset['adslot']).toBe('live')
      expect(iframes(slot)).toHaveLength(1)
    }
  })

  it('reserves the same height whether or not the unit arrives', async () => {
    const waiting = await newSlot({ placement: 'inline' })
    const live = await newSlot({ placement: 'inline', isIdle: () => true })
    waiting.sync()
    live.sync()

    expect(waiting.element.className).toBe(live.element.className)
    expect(waiting.element.dataset['adslot-placement']).toBe(
      live.element.dataset['adslot-placement'],
    )
  })
})

describe('every page declares its placements', () => {
  const ENTRIES = ['src/main.ts', 'src/analysis.ts', 'src/simulator.ts', 'src/encyclopedia.ts'] as const

  it('every page passes a placement that exists', () => {
    const known = new Set<string>(AD_PLACEMENTS)
    const offenders: string[] = []

    for (const entry of ENTRIES) {
      const source = readRepo(entry)
      for (const match of source.matchAll(/createAdSlot\(\{([^}]*)\}\)/g)) {
        const placement = /placement:\s*'([^']+)'/.exec(match[1] ?? '')?.[1]
        if (placement === undefined || !known.has(placement)) {
          offenders.push(`${entry}: ${placement ?? '<none>'}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('every page mounts at least one unit and one of them is the footer', () => {
    // Derived by counting the calls rather than typed, so adding a page without
    // a unit — or a unit without a page — fails here instead of in production.
    for (const entry of ENTRIES) {
      const source = readRepo(entry)
      const calls = source.match(/createAdSlot\(\{/g) ?? []
      expect(calls.length, entry).toBeGreaterThanOrEqual(2)
      expect(source, entry).toMatch(/placement:\s*'footer'/)
    }
  })

  it('the table page gates its in-game unit on the table being idle', () => {
    const source = readRepo('src/main.ts')
    expect(source).toMatch(/placement:\s*'idle'/)
    // The three conditions are the promise the placement makes. Each is named
    // here because dropping one would put an ad on screen during a spin or
    // under a pending bet, and the suite has no browser to notice.
    expect(source).toMatch(/isIdle:\s*\(\)\s*=>\s*spins > 0 && !wheel\.isSpinning\(\) && !hasBets\(state\)/)
  })

  it('no placement rule raises a z-index above the shared frame', () => {
    // The containment lives on .adslot__frame so a placement added later
    // inherits it instead of having to remember it. A placement that sets its
    // own z-index is a placement that has been given a way to lose that.
    const css = readRepo('src/styles/adslot.css')
    const rules = [...css.matchAll(/\[data-adslot-placement='([^']+)'\]/g)].map((m) => m[1])
    expect(rules.length).toBeGreaterThan(0)

    for (const match of css.matchAll(/\[data-adslot-placement='[^']+'\][^{]*\{([^}]*)\}/g)) {
      expect(match[1]).not.toMatch(/z-index/)
    }
  })

  it('every non-live state reserves the frame', () => {
    const css = readRepo('src/styles/adslot.css')
    expect(css).toMatch(/\[data-adslot='empty'\]\s*\.adslot__frame/)
    expect(css).toMatch(/\[data-adslot='waiting'\]\s*\.adslot__frame/)
  })
})