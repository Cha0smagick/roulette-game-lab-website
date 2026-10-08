import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installDom, type InstalledDom, type StubElement } from './helpers/dom.js'
import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  parseHistory,
  pushOutcome,
  statsFor,
} from '../src/roulette/history.js'
import { colourOf, type Pocket } from '../src/roulette/wheels.js'

/**
 * The live spin strip, the observed-counts panel, the shared store and the
 * analysis page entry.
 *
 * The DOM stub has no layout engine and no hit testing, so none of these tests
 * claims anything about how the page looks. What they do pin is the arithmetic
 * and the honesty rules, and both of those are properties of code rather than of
 * pixels: which pocket is first, how many cells exist, whether a repeat streak
 * is given any visual emphasis it has not earned, and whether a store that
 * refuses to answer takes the page down.
 *
 * The UI modules are imported DYNAMICALLY after `installDom()` because
 * `i18n/index.js` resolves a locale at module scope and therefore needs
 * `localStorage` and `navigator` to exist before it loads. Importing it
 * statically at the top of this file is a ReferenceError at collection time.
 */

let dom: InstalledDom

/**
 * Recorded cells are the ones the strip actually shows.
 *
 * The cast is honest about what is happening: the UI modules are typed against
 * the browser `HTMLElement`, while the queries only exist on the stub. Every
 * stub method this uses is asserted by the stub's own tests, so the cast does
 * not hide a behaviour difference — it hides a type difference.
 */
function cells(strip: { readonly element: HTMLElement }): StubElement[] {
  return (
    strip.element as unknown as StubElement
  ).findAllByClass('hist__cell')
}

/** The five `<dd>` values of the panel, in the order the panel lists them. */
function values(panel: { readonly element: HTMLElement }): string[] {
  return (panel.element as unknown as StubElement)
    .findAllByClass('stats__value')
    .map((element: StubElement) => element.textContent ?? '')
}

/** `statsFor` asks whether a pocket is red; the wheel already knows. */
const isRed = (pocket: Pocket): boolean => colourOf(pocket) === 'red'

/** A history of `count` spins, oldest first, so pushing the last one wins. */
function historyOf(...pockets: readonly Pocket[]): ReturnType<typeof pushOutcome> {
  let history = EMPTY_HISTORY
  for (const pocket of pockets) {
    history = pushOutcome(history, pocket)
  }
  return history
}

beforeEach(() => {
  dom = installDom()
  vi.resetModules()
})

describe('the strip shows the most recent spin first', () => {
  it('puts the newest entry at the head of the strip', async () => {
    const { createHistoryStrip } = await import('../src/ui/history.js')
    const strip = createHistoryStrip()
    // Pushed oldest-first, so the list below is in reverse of the pushes.
    strip.render(historyOf(5, 17, 1))

    expect(cells(strip).map((cell) => cell.textContent)).toEqual(['1', '17', '5'])
  })

  it('renders the capped history length, not the number of spins played', async () => {
    const { createHistoryStrip } = await import('../src/ui/history.js')
    let history = EMPTY_HISTORY
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      history = pushOutcome(history, (i % 37) + 1)
    }
    // Without this the assertion below would also pass for a strip that showed
    // every spin ever played, which is the mistake this test exists to catch.
    expect(history.entries).toHaveLength(HISTORY_LIMIT)

    const strip = createHistoryStrip()
    strip.render(history)

    expect(cells(strip)).toHaveLength(history.entries.length)
  })

  it('prepends a pushed outcome and evicts the oldest once the cap is reached', () => {
    const one = pushOutcome(EMPTY_HISTORY, 7)
    const two = pushOutcome(one, 21)
    expect(two.entries[0]).toBe(21)
    expect(two.entries[two.entries.length - 1]).toBe(7)

    let full = pushOutcome(EMPTY_HISTORY, 33)
    for (let i = 0; i < HISTORY_LIMIT; i += 1) {
      full = pushOutcome(full, 4)
    }
    expect(full.entries).toHaveLength(HISTORY_LIMIT)
    expect(full.entries.includes(33)).toBe(false)
  })
})

describe('the strip records spins and claims nothing about them', () => {
  it('gives every cell the colour the wheel says and a spoken name', async () => {
    const { createHistoryStrip } = await import('../src/ui/history.js')
    const strip = createHistoryStrip()
    const pockets: readonly Pocket[] = [0, 1, 2]
    strip.render({ entries: pockets })

    const shown = cells(strip)
    expect(shown).toHaveLength(pockets.length)
    for (let i = 0; i < pockets.length; i += 1) {
      const pocket = pockets[i]
      const cell = shown[i]
      if (pocket === undefined || cell === undefined) {
        throw new Error('expected one cell per pocket')
      }
      expect(cell.dataset['colour']).toBe(colourOf(pocket))
      const label = cell.getAttribute('aria-label') ?? ''
      expect(label).toContain(String(pocket))
    }

    // A red and a black pocket must not be announced identically, which is the
    // only part of the label a test can prove without restating the template.
    const red = shown.find((cell) => cell.dataset['colour'] === 'red')
    const black = shown.find((cell) => cell.dataset['colour'] === 'black')
    expect(red?.getAttribute('aria-label')).not.toBe(black?.getAttribute('aria-label'))
  })

  it('gives a repeated number no emphasis at all', async () => {
    const { createHistoryStrip } = await import('../src/ui/history.js')
    const strip = createHistoryStrip()
    strip.render(historyOf(17, 17, 17, 2))

    // A repeat streak is the single most misread thing a player can see. If the
    // strip highlighted it, the highlight would be a promise about the next
    // spin, and a wheel makes none.
    for (const cell of cells(strip)) {
      expect(cell.className).toBe('hist__cell')
    }
  })

  it('says plainly that nothing has been recorded yet', async () => {
    const { createHistoryStrip } = await import('../src/ui/history.js')
    const strip = createHistoryStrip()
    strip.render(EMPTY_HISTORY)

    expect(cells(strip)).toHaveLength(0)
    const wrapped = strip.element as unknown as StubElement
    expect(wrapped.findAllByClass('hist__empty')).toHaveLength(1)
  })
})

describe('observed counts are counted, not interpreted', () => {
  it('reports the capped total the engine computed', async () => {
    const { createStatsPanel } = await import('../src/ui/stats.js')
    let history = EMPTY_HISTORY
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      history = pushOutcome(history, (i % 36) + 1)
    }
    const stats = statsFor(history, isRed)
    expect(stats.total).toBe(history.entries.length)

    const panel = createStatsPanel()
    panel.render(history)

    expect(values(panel)[0]).toBe(String(stats.total))
  })

  it('lists the pockets the engine called most frequent', async () => {
    const { createStatsPanel } = await import('../src/ui/stats.js')
    // 12 appears three times, everything else once, so the leader is alone.
    const history = historyOf(12, 4, 12, 12, 9, 30)
    const stats = statsFor(history, isRed)
    expect(stats.hot).toEqual([12])

    const panel = createStatsPanel()
    panel.render(history)

    expect(values(panel)[3]).toBe(String(stats.hot[0]))
  })

  it('lists every pocket seen exactly once', async () => {
    const { createStatsPanel } = await import('../src/ui/stats.js')
    const pockets: readonly Pocket[] = [7, 7, 22, 3, 30, 1, 19, 9]
    const history = historyOf(...pockets)
    const stats = statsFor(history, isRed)
    expect(stats.cold).toHaveLength(6)

    const panel = createStatsPanel()
    panel.render(history)

    const listed = (values(panel)[4] ?? '').split(', ')
    expect(listed).toHaveLength(stats.cold.length)
    for (const pocket of stats.cold) {
      expect(values(panel)[4]).toContain(String(pocket))
    }
  })

  it('reports no run and no repeat when there is none', async () => {
    const { createStatsPanel } = await import('../src/ui/stats.js')
    const panel = createStatsPanel()

    panel.render(EMPTY_HISTORY)
    const none = values(panel)

    // A single zero has no repeat and no colour run: a zero stops a red run,
    // and a run of one is not a run. Only the run and the repeat are compared,
    // because adding a spin legitimately moves the total and reshuffles which
    // pockets are most and least frequent.
    panel.render(pushOutcome(EMPTY_HISTORY, 0))
    expect(values(panel).slice(1, 3)).toEqual(none.slice(1, 3))
  })

  it('reports a colour run and a repeat when they are there', async () => {
    const { createStatsPanel } = await import('../src/ui/stats.js')
    const history = historyOf(2, 9, 3, 1, 17, 17, 17)
    const stats = statsFor(history, isRed)
    expect(stats.colourRun?.length).toBeGreaterThan(1)
    expect(stats.streak?.pocket).toBe(17)

    const panel = createStatsPanel()
    panel.render(history)

    const shown = values(panel)
    expect(shown[1]).toContain(String(stats.colourRun?.length ?? 0))
    expect(shown[2]).toContain(String(stats.streak?.length ?? 0))
  })
})

describe('a store that refuses to answer does not take the page down', () => {
  it('round-trips a history through storage', async () => {
    const { HISTORY_STORAGE_KEY, loadHistory, recordOutcome } = await import(
      '../src/ui/history-store.js'
    )
    expect(typeof HISTORY_STORAGE_KEY).toBe('string')
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull()

    const recorded = recordOutcome(EMPTY_HISTORY, 12)
    expect(recorded.entries[0]).toBe(12)
    expect(loadHistory().entries[0]).toBe(12)
  })

  it('treats corrupt stored data as no history rather than a crash', async () => {
    const { HISTORY_STORAGE_KEY, loadHistory } = await import('../src/ui/history-store.js')
    localStorage.setItem(HISTORY_STORAGE_KEY, '{ this is not json')
    expect(loadHistory().entries).toEqual([])

    localStorage.setItem(HISTORY_STORAGE_KEY, '{"not":"an array"}')
    expect(loadHistory().entries).toEqual([])
  })

  it('reads nothing usable out of a value that is not a list of pockets', () => {
    // `parseHistory` is the engine's own contract and this is the boundary the
    // store relies on: absent, unparseable, wrong shape, non-numeric members.
    expect(parseHistory(null).entries).toEqual([])
    expect(parseHistory('nonsense').entries).toEqual([])
    expect(parseHistory('{"entries":[]}').entries).toEqual([])
    expect(parseHistory('[1,"two",3,null,4]').entries).toEqual([1, 3, 4])
  })

  it('survives a store that throws on read and on write', async () => {
    const { loadHistory, saveHistory } = await import('../src/ui/history-store.js')
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => loadHistory()).not.toThrow()
    expect(loadHistory().entries).toEqual([])
    expect(() => saveHistory(pushOutcome(EMPTY_HISTORY, 3))).not.toThrow()
  })
})

describe('the analysis page entry', () => {
  it('boots and paints the history the table recorded', async () => {
    const { HISTORY_STORAGE_KEY, saveHistory } = await import('../src/ui/history-store.js')
    saveHistory(historyOf(5, 17, 1))

    await import('../src/analysis.js')

    expect(dom.app.className).toBe('shell shell--page')
    expect(dom.app.findByTag('main')[0]?.className).toBe('analysis')
    expect(dom.app.findByClass('adslot')?.dataset['adslot']).toBe('live')

    const strip = dom.app.findByClass('hist')
    expect(strip?.findAllByClass('hist__cell').map((cell) => cell.textContent)).toEqual([
      '1',
      '17',
      '5',
    ])

    // The panel total is the same number, read from the same history, which is
    // the entire reason the two documents exist.
    const stored = parseHistory(localStorage.getItem(HISTORY_STORAGE_KEY))
    const total = dom.app.findByClass('stats')?.findByClass('stats__value')
    expect(total?.textContent).toBe(String(stored.entries.length))
  })
})