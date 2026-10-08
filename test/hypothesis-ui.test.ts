import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installDom, type StubElement } from './helpers/dom.js'
import { EMPTY_HISTORY, pushOutcome, type History } from '../src/roulette/history.js'
import { EUROPEAN, pickPocket, type Pocket } from '../src/roulette/wheels.js'
import { createRng } from '../src/util/rng.js'
import { pocketZScores } from '../src/stats/hypothesis.js'

/**
 * The goodness-of-fit panel.
 *
 * What is asserted here is the honesty of the panel, not its arithmetic: the
 * arithmetic is pinned by test/stats.test.ts. These tests exist because the two
 * claims that matter are both about what the panel does NOT say — it must refuse
 * the test a hundred spins cannot support, and it must say how few more spins
 * that would take. A panel that quietly omitted the per-number test would look
 * identical to a panel that ran it and found nothing, and the difference between
 * those two is the entire reason this project exists.
 *
 * Imported dynamically because i18n/index.js resolves a locale at module scope,
 * which needs localStorage and navigator to exist first; a static import is a
 * ReferenceError at collection time.
 */

// Installed for its side effect only: it puts document and localStorage on the
// globalThis, which the panel and the i18n module both read at import time.
beforeEach(() => {
  installDom()
  vi.resetModules()
})

async function panel(): Promise<{
  element: HTMLElement
  render(history: History): void
}> {
  const module = await import('../src/ui/hypothesis-panel.js')
  return module.createHypothesisPanel()
}

/** The stub is typed as the browser's HTMLElement; these queries only exist on it. */
function wrapped(element: HTMLElement): StubElement {
  return element as unknown as StubElement
}

function texts(elements: readonly StubElement[]): string[] {
  return elements.map((element) => element.textContent ?? '')
}

function seededSpins(count: number, seed: string): Pocket[] {
  const rng = createRng(seed)
  const spins: Pocket[] = []
  for (let i = 0; i < count; i += 1) {
    spins.push(pickPocket(EUROPEAN, (max) => rng.int(max)))
  }
  return spins
}

function historyOf(pockets: readonly Pocket[]): History {
  // Folded oldest-first so the last pocket pushed is the newest, matching how the
  // table page records a spin.
  return pockets.reduce((history, pocket) => pushOutcome(history, pocket), EMPTY_HISTORY)
}

describe('the panel answers the question a session can answer and refuses the one it cannot', () => {
  it('says it has nothing rather than showing zeroes that look like a result', async () => {
    const fit = await panel()
    fit.render(EMPTY_HISTORY)

    const root = wrapped(fit.element)
    expect(root.findAllByClass('fit__empty')[0]?.hidden).toBe(false)
    expect(root.findAllByClass('fit__card')).toHaveLength(0)
    expect(root.findAllByClass('fit__z')).toHaveLength(0)
  })

  it('answers the parity question and refuses the per-number one at a hundred spins', async () => {
    const fit = await panel()
    const pockets = seededSpins(100, 'hypothesis-parity')
    fit.render(historyOf(pockets))

    const cards = wrapped(fit.element).findAllByClass('fit__card')
    expect(cards).toHaveLength(2)

    // The parity split is the only outcome set whose smallest expected count
    // clears the reliability floor inside the hundred spins a session keeps, so
    // it is the only one that can honestly be answered here.
    expect(cards[0]?.findAllByClass('fit__verdict')[0]?.className).toContain('fit__verdict--uniform')

    // Thirty-seven outcomes over a hundred spins cannot be tested. The panel is
    // required to say so rather than to omit the test and let the absence read
    // as a clean result.
    expect(cards[1]?.findAllByClass('fit__verdict')[0]?.className).toContain('fit__verdict--refused')
  })

  it('states how many more spins the refusal needs', async () => {
    const fit = await panel()
    fit.render(historyOf(seededSpins(100, 'hypothesis-refusal')))

    const cards = wrapped(fit.element).findAllByClass('fit__card')
    const verdict = cards[1]?.findAllByClass('fit__verdict')[0]
    const label = verdict?.textContent ?? ''

    // The verdict label on its own contains no figure; the shortfall appended to
    // it does. Asserting a digit is here is what proves the number was published
    // rather than asserting a count this test would have to invent.
    expect(/[0-9]/.test(label)).toBe(true)
  })

  it('never prints a p-value as zero', async () => {
    const fit = await panel()
    // Every spin the same number drives the statistic so far into the tail that
    // the p-value underflows what the formatter can print.
    fit.render(historyOf(Array.from({ length: 100 }, () => 17)))

    const root = wrapped(fit.element)
    const labels = root.findAllByClass('fit__label')
    const values = root.findAllByClass('fit__value')
    const pIndex = labels.findIndex((label) => label.dataset['i18n'] === 'stats.pValue')

    expect(pIndex).toBeGreaterThan(-1)
    expect(values[pIndex]?.textContent).not.toBe('0')
  })
})

describe('the deviation list is a shortlist, not a ranking', () => {
  it('shows every pocket the engine scored when there are fewer than the cap', async () => {
    const { MAX_DEVIATIONS } = await import('../src/ui/hypothesis-panel.js')
    const pockets = seededSpins(60, 'hypothesis-short')
    const fit = await panel()
    fit.render(historyOf(pockets))

    // Derived from the engine's own scoring rather than a number typed here, so
    // the assertion survives the cap being raised.
    const scored = pocketZScores(pockets, EUROPEAN).length
    expect(wrapped(fit.element).findAllByClass('fit__z')).toHaveLength(Math.min(MAX_DEVIATIONS, scored))
  })

  it('leads with the most deviant number the engine found', async () => {
    const pockets = seededSpins(100, 'hypothesis-order')
    const fit = await panel()
    fit.render(historyOf(pockets))

    // pocketZScores sorts by |z| descending, so its first element is the one the
    // list is required to lead with. Comparing against the engine is the only
    // version of this assertion that is not a restatement of the source.
    const top = pocketZScores(pockets, EUROPEAN)[0]?.pocket
    const firstRow = wrapped(fit.element).findAllByClass('fit__z')[0]
    expect(firstRow?.findAllByClass('fit__z-pocket')[0]?.textContent).toBe(String(top))
  })

  it('prints the count beside the count a fair wheel gives', async () => {
    const pockets = seededSpins(100, 'hypothesis-figures')
    const fit = await panel()
    fit.render(historyOf(pockets))

    const top = pocketZScores(pockets, EUROPEAN)[0]
    const figures = wrapped(fit.element).findAllByClass('fit__z')[0]?.findAllByClass('fit__z-value')
    // Three figures per row: count, expected, z. §9.0 requires the observation and
    // the fair-wheel expectation to be readable side by side, so the row carries
    // both rather than a difference the reader has to reconstruct.
    expect(figures).toHaveLength(3)

    // formatNumber rounds to three decimal places, so the expectation is compared
    // at that precision rather than as a raw double. Demanding full float equality
    // would be asserting that the panel prints 2.7027027027027026, which is not a
    // number a reader can be shown and not what the panel promises.
    const printed = texts(figures ?? []).map(Number)
    expect(printed[0]).toBe(top?.count)
    expect(printed[1]).toBeCloseTo(top?.expected ?? 0, 2)
  })
})