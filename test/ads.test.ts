import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

import { AADS_ENABLED, AADS_ORIGIN, AADS_SIZES, AADS_UNIT_ID, aadsSrc } from '../src/ads/aads.js'

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