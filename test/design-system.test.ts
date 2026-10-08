import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { BLACK_FILL, BONE, BRASS, BRASS_DARK, GREEN_FILL, RED_FILL } from '../src/ui/wheel.js'

/**
 * A design system is only real if it is enforced. Nothing here reads a value at
 * runtime; every assertion compares two sources that would otherwise be free to
 * disagree quietly.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STYLE_DIR = join(ROOT, 'src', 'styles')
const BASE_CSS = join(STYLE_DIR, 'base.css')

const PAGES = ['index.html', 'simulator.html', 'encyclopedia.html'] as const

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function stylesheets(): string[] {
  return readdirSync(STYLE_DIR)
    .filter((name) => name.endsWith('.css'))
    .map((name) => join(STYLE_DIR, name))
}

/** Every `--name: value` custom property declared in a file. */
function customProperties(source: string): Map<string, string> {
  const found = new Map<string, string>()
  const pattern = /^\s*(--[\w-]+)\s*:\s*([^;]+);/gm
  let match = pattern.exec(source)
  while (match !== null) {
    const name = match[1]
    const value = match[2]
    if (name !== undefined && value !== undefined) found.set(name, value.trim())
    match = pattern.exec(source)
  }
  return found
}

describe('the palette is declared once', () => {
  const tokens = customProperties(read(BASE_CSS))

  it('declares the surface, accent, ink and betting colours', () => {
    for (const name of ['--navy', '--brass', '--bone', '--felt', '--red', '--black', '--green']) {
      expect(tokens.get(name), `${name} is missing from base.css`).toBeTruthy()
    }
  })

  it('gives the accent and the ink their roulette names, with aliases for the old ones', () => {
    // The wheel's rim is brass and its digits are bone; the CSS used to call
    // those amber and white with different values, which is why the two never
    // matched on screen.
    expect(tokens.get('--brass')).toBe('#c9a227')
    expect(tokens.get('--bone')).toBe('#f5f2e8')
    expect(tokens.get('--amber')).toBe('var(--brass)')
    expect(tokens.get('--white')).toBe('var(--bone)')
  })

  it('reserves the two betting colours for the board', () => {
    expect(tokens.get('--red')).toBe(RED_FILL)
    expect(tokens.get('--black')).toBe(BLACK_FILL)
    expect(tokens.get('--green')).toBe(GREEN_FILL)
  })
})

describe('the canvas renderer uses the same colours as the stylesheets', () => {
  const tokens = customProperties(read(BASE_CSS))

  it('shares the brass rim and the bone digits', () => {
    expect(BRASS).toBe(tokens.get('--brass'))
    expect(BRASS_DARK).toBe(tokens.get('--brass-dark'))
    expect(BONE).toBe(tokens.get('--bone'))
  })

  it('shares the betting colours', () => {
    expect(RED_FILL).toBe(tokens.get('--red'))
    expect(BLACK_FILL).toBe(tokens.get('--black'))
    expect(GREEN_FILL).toBe(tokens.get('--green'))
  })

  it('draws the wheel on the same ground the page uses', () => {
    expect(tokens.get('--navy')).toBe('#0b1026')
  })
})

describe('no stylesheet hardcodes a colour the tokens already own', () => {
  it('keeps raw hex values in base.css only', () => {
    const offenders: string[] = []
    for (const path of stylesheets()) {
      if (path === BASE_CSS) continue
      const hexes = read(path).match(/#[0-9a-f]{3,8}\b/gi) ?? []
      if (hexes.length > 0) offenders.push(`${path}: ${hexes.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('every page declares a mobile viewport', () => {
  it('uses device width, no user zoom lock, and cover for the notch', () => {
    for (const page of PAGES) {
      const html = read(join(ROOT, page))
      expect(html, `${page} viewport`).toMatch(
        /name="viewport"[^>]*width=device-width[^>]*initial-scale=1[^>]*viewport-fit=cover/,
      )
      // user-scalable=no or maximum-scale=1 fails WCAG 1.4.4 and gets ignored by
      // mobile Safari anyway, which leaves the page zoomed for no benefit.
      expect(html, `${page} must not block zoom`).not.toMatch(/user-scalable=no|maximum-scale=1\b/)
    }
  })

  it('is in English, which is the product language', () => {
    for (const page of PAGES) {
      expect(read(join(ROOT, page)), `${page} lang`).toMatch(/<html lang="en">/)
    }
  })

  it('renders something before the bundle runs, so a failure is never a blank page', () => {
    for (const page of PAGES) {
      const html = read(join(ROOT, page))
      expect(html, `${page} boot markup`).toMatch(/id="app"/)
      expect(html, `${page} noscript`).toMatch(/<noscript>/)
    }
  })
})

describe('nothing forces the page wider than a small phone', () => {
  /**
   * A fixed width above 320px is the one thing that reliably produces a
   * horizontal scrollbar on the narrowest device still in real use, and it is
   * invisible on the machine that authored the CSS. max-width is fine; it is
   * only an unbounded minimum that cannot be shrunk.
   */
  it('declares no min-width or fixed width above 320px', () => {
    const offenders: string[] = []
    // The property must follow a declaration boundary, otherwise an @media
    // condition like `(min-width: 720px)` reads as a width declaration.
    const pattern = /(?:^|[;{])\s*((?:min-|max-)?width)\s*:\s*(\d+)px/gm
    for (const path of stylesheets()) {
      const source = read(path)
      let match = pattern.exec(source)
      while (match !== null) {
        const property = match[1] ?? ''
        const value = Number(match[2])
        if (property !== 'max-width' && value > 320) offenders.push(`${path}: ${match[0]}`)
        match = pattern.exec(source)
      }
    }
    expect(offenders).toEqual([])
  })

  it('only stops wrapping where the content can scroll inside its own box', () => {
    // A nowrap cell is correct for a number that must not be split across two
    // lines, and wrong for anything that makes the page itself scroll sideways.
    // The guard is therefore the presence of an overflow-x box in the same
    // stylesheet, not the absence of nowrap.
    const offenders: string[] = []
    for (const path of stylesheets()) {
      const source = read(path)
      if (source.includes('white-space') && !source.includes('overflow-x')) offenders.push(path)
    }
    expect(offenders).toEqual([])
  })
})

describe('the shell respects the device it is on', () => {
  const base = read(BASE_CSS)

  it('pads for notches and the home bar', () => {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      expect(base, `safe-area-inset-${edge}`).toContain(`env(safe-area-inset-${edge}`)
    }
  })

  it('uses viewport units that follow a mobile URL bar', () => {
    // 100vh on mobile Safari is the height of the viewport with the bar HIDDEN,
    // which cuts off the footer. dvh tracks the real viewport.
    expect(base).toContain('100dvh')
    expect(base).not.toMatch(/height\s*:\s*100vh/)
  })

  it('gives every animated rule sheet a reduced-motion opt-out', () => {
    const offenders: string[] = []
    for (const path of stylesheets()) {
      const source = read(path)
      if (source.includes('transition') && !source.includes('prefers-reduced-motion')) {
        offenders.push(path)
      }
    }
    expect(offenders).toEqual([])
  })

  it('declares the touch target as a token so the rule is checkable', () => {
    expect(customProperties(base).get('--touch-target')).toBe('44px')
  })
})