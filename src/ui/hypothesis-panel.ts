/**
 * The goodness-of-fit panel.
 *
 * Three chi-square tests and a deviation list, and the pairing is the whole
 * point. The parity split is the only outcome set a human session can actually
 * answer: with a hundred recorded spins its smallest expected count is fifty.
 * The per-number test is the one everybody wants, and at that sample size it is
 * not merely noisy but unanswerable, so it is shown here REFUSING rather than
 * quietly omitted. The transition matrix over colour refuses for the same
 * reason: a green-to-green cell is almost never seen, so its expected counts
 * sit far below the reliability floor at any sample size a session keeps.
 * A refusal a reader can see is the honest version of a tool
 * that reports nothing and lets the absence pass for a clean result.
 *
 * Every figure printed here appears beside the figure a fair wheel predicts.
 * A p-value on its own is a claim with nothing to compare it to.
 */
import { formatNumber, t } from '../i18n/index.js'
import type { TranslationKey } from '../i18n/index.js'
import { EUROPEAN } from '../roulette/wheels.js'
import type { History } from '../roulette/history.js'
import {
  chiSquareAgainst,
  parityBins,
  pocketBins,
  pocketZScores,
  verdict,
} from '../stats/hypothesis.js'
import type { BinObservation, ChiSquareTest, Verdict } from '../stats/hypothesis.js'
import { classifyByColour, transitionMatrix } from '../stats/markov.js'
import type { MarkovCell, MarkovResult } from '../stats/markov.js'

/**
 * How many numbers the deviation list shows. Five is enough to look like a
 * shortlist and few enough that a reader does not mistake the list for a
 * ranking. It is a number the reader can count on screen, which is why it is a
 * constant rather than something derived from the history length.
 *
 * Exported so the test can assert the list against it rather than against a
 * number typed a second time: a display cap that only exists in the source is a
 * cap nothing can prove was honoured.
 */
export const MAX_DEVIATIONS = 5

/**
 * Below this the p-value is reported as a bound rather than a number. Intl's
 * default gives three decimal places, which prints a p-value of 0.0004 as "0",
 * and "p = 0" is a claim this engine does not make: it means "smaller than I
 * can print", which is a different statement.
 */
const P_VALUE_FLOOR = 0.001

const VERDICT_KEY: Record<Verdict['level'], TranslationKey> = {
  uniform: 'stats.verdictUniform',
  weak: 'stats.verdictWeak',
  strong: 'stats.verdictStrong',
  refused: 'stats.verdictRefused',
}

/**
 * Bin ids mapped to the labels that already exist elsewhere in the dictionary.
 * Written as an explicit record rather than computed from the id so that a bin
 * set nobody has named fails the build instead of printing a raw id at the
 * reader. There is deliberately no colour test on this panel, but the colour
 * keys are mapped anyway: adding one later should not need a new label.
 */
const BIN_LABEL: Record<string, TranslationKey> = {
  odd: 'bet.odd',
  even: 'bet.even',
  red: 'common.colour.red',
  black: 'common.colour.black',
  green: 'common.colour.green',
}

function outcomeLabel(outcome: BinObservation): string {
  const key = BIN_LABEL[outcome.id]
  if (key !== undefined) return t(key)
  // Pocket bins are named for their value, so the number IS the label.
  if (outcome.id.startsWith('n')) return outcome.id.slice(1)
  // A bin set nobody has named: print the id, which is visibly unfinished
  // rather than quietly mistranslated.
  return outcome.id
}

/** "odd 48 / 50" — the observed count beside the count a fair wheel gives. */
function outcomeText(outcome: BinObservation): string {
  return `${outcomeLabel(outcome)} ${formatNumber(outcome.count)} / ${formatNumber(outcome.expected)}`
}

/**
 * The outcome whose count sits furthest from what a fair wheel predicts. For
 * the parity split that is the whole story in one figure. For the per-number
 * test it is the largest of thirty-seven gaps, which is why the verdict line
 * beside it is what the reader should actually take away.
 */
function widestGap(test: ChiSquareTest): BinObservation | null {
  let worst: BinObservation | null = null
  for (const outcome of test.outcomes) {
    if (worst === null || Math.abs(outcome.count - outcome.expected) > Math.abs(worst.count - worst.expected)) {
      worst = outcome
    }
  }
  return worst
}

function pValueText(p: number): string {
  if (p >= P_VALUE_FLOOR) return formatNumber(p)
  return t('stats.pValueBelow', { bound: formatNumber(P_VALUE_FLOOR) })
}

/**
 * A state of the chain mapped onto the labels the outcome rows already use. A
 * state this module does not name prints its raw label rather than being
 * silently mistranslated.
 */
function stateLabel(state: string): string {
  const key = BIN_LABEL[state]
  return key === undefined ? state : t(key)
}

/**
 * "red → black 5 / 23.4" — the transition with the largest excess: the state
 * that came first, the state that followed, the observed count beside the count
 * independence predicts, in chronological order.
 */
function strongestText(cell: MarkovCell | null): string {
  if (cell === null) return ''
  return `${stateLabel(cell.from)} → ${stateLabel(cell.to)} ${formatNumber(cell.observed)} / ${formatNumber(cell.expected)}` // i18n-exempt: dictionary labels, an arrow and figures
}

/**
 * The sign is spelled out rather than left to a space in a proportional
 * figure: a column of z-scores where the positive ones are unmarked reads as a
 * column of magnitudes.
 */
function signed(value: number): string {
  if (value > 0) return `+${formatNumber(value)}` // i18n-exempt: a mathematical sign, not copy
  return formatNumber(value) // i18n-exempt: a number and its sign, not copy
}

function row(labelKey: TranslationKey): { term: HTMLElement; value: HTMLElement } {
  const term = document.createElement('dt')
  term.className = 'fit__label'
  term.dataset['i18n'] = labelKey
  const value = document.createElement('dd')
  value.className = 'fit__value'
  return { term, value }
}

function card(titleKey: TranslationKey, test: ChiSquareTest): HTMLElement {
  const box = document.createElement('section')
  box.className = 'fit__card'

  const heading = document.createElement('h3')
  heading.className = 'fit__card-title'
  heading.dataset['i18n'] = titleKey

  const list = document.createElement('dl')
  list.className = 'fit__rows'

  const gap = widestGap(test)
  const rows: ReadonlyArray<readonly [TranslationKey, string]> = [
    ['stats.spinstested', formatNumber(test.total)],
    ['stats.statistic', formatNumber(test.chi2)],
    ['stats.degrees', formatNumber(test.df)],
    ['stats.pValue', pValueText(test.pValue)],
    ['stats.minExpected', formatNumber(test.minExpected)],
    ['stats.outcomes', gap === null ? '' : outcomeText(gap)],
  ]
  for (const [labelKey, value] of rows) {
    const pair = row(labelKey)
    pair.value.textContent = value // i18n-exempt: figures and their labels come from the dictionary above
    list.append(pair.term, pair.value)
  }

  const result = verdict(test)
  const line = document.createElement('p')
  line.className = `fit__verdict fit__verdict--${result.level}`
  const label = t(VERDICT_KEY[result.level])
  // The refusal is printed with the number of spins it needs, because "too few
  // spins to answer" invites the reader to guess how few.
  line.textContent = result.level === 'refused'
    ? `${label} ${t('stats.moreNeeded', { count: formatNumber(result.shortfall) })}` // i18n-exempt: composed from two dictionary strings
    : label

  box.append(heading, list, line)
  return box
}

/**
 * The transition matrix as the third chi-square test, built over colour — the
 * classification every roulette tracker ships first, and the one with the most
 * cells per state at a human sample size. Its smallest expected cell is a
 * green-to-green transition, which is almost never seen, so at any sample size
 * a session keeps the test refuses — and it is shown refusing rather than
 * quietly omitted, for the same reason the per-number test is.
 */
function transitionCard(result: MarkovResult): HTMLElement {
  const box = document.createElement('section')
  box.className = 'fit__card'

  const heading = document.createElement('h3')
  heading.className = 'fit__card-title'
  heading.dataset['i18n'] = 'stats.transitionsTest'

  const list = document.createElement('dl')
  list.className = 'fit__rows'

  const rows: ReadonlyArray<readonly [TranslationKey, string]> = [
    ['stats.spinstested', formatNumber(result.transitions)],
    ['stats.statistic', formatNumber(result.chi2)],
    ['stats.degrees', formatNumber(result.degreesOfFreedom)],
    ['stats.pValue', pValueText(result.pValue)],
    ['stats.minExpected', formatNumber(result.minExpected)],
    ['stats.strongestCell', strongestText(result.strongest)],
  ]
  for (const [labelKey, value] of rows) {
    const pair = row(labelKey)
    pair.value.textContent = value // i18n-exempt: figures and their labels come from the dictionary above
    list.append(pair.term, pair.value)
  }

  const line = document.createElement('p')
  line.className = `fit__verdict fit__verdict--${result.verdict.level}`
  const label = t(VERDICT_KEY[result.verdict.level])
  // The refusal is printed with the number of spins it needs, because "too few
  // spins to answer" invites the reader to guess how few.
  line.textContent = result.verdict.level === 'refused'
    ? `${label} ${t('stats.moreNeeded', { count: formatNumber(result.verdict.shortfall) })}` // i18n-exempt: composed from two dictionary strings
    : label

  box.append(heading, list, line)
  return box
}

function deviationList(history: History): HTMLElement {
  const box = document.createElement('section')
  box.className = 'fit__deviation'

  const heading = document.createElement('h3')
  heading.className = 'fit__card-title'
  heading.dataset['i18n'] = 'stats.deviation'

  const list = document.createElement('ol')
  list.className = 'fit__zlist'

  for (const score of pocketZScores(history.entries, EUROPEAN).slice(0, MAX_DEVIATIONS)) {
    const item = document.createElement('li')
    item.className = 'fit__z'

    const pocket = document.createElement('b')
    pocket.className = 'fit__z-pocket'
    pocket.textContent = String(score.pocket) // i18n-exempt: pocket number as printed on felt

    const figures = document.createElement('span')
    figures.className = 'fit__z-figures'
    for (const [labelKey, value] of [
      ['stats.count', formatNumber(score.count)],
      ['stats.expected', formatNumber(score.expected)],
      ['stats.zScore', signed(score.z)],
    ] as const) {
      const label = document.createElement('span')
      label.className = 'fit__z-label'
      label.dataset['i18n'] = labelKey
      const figure = document.createElement('span')
      figure.className = 'fit__z-value'
      figure.textContent = value // i18n-exempt: a count, an expectation or a signed z-score
      figures.append(label, figure)
    }

    item.append(pocket, figures)
    list.append(item)
  }

  const caption = document.createElement('p')
  caption.className = 'fit__caption'
  caption.dataset['i18n'] = 'stats.deviationCaption'

  box.append(heading, list, caption)
  return box
}

export interface HypothesisPanel {
  readonly element: HTMLElement
  render(history: History): void
}

/**
 * The panel is built against the European wheel because that is the wheel the
 * table page plays. A test run against a different wheel would compare counts
 * to the wrong expectations, which is a worse failure than not testing at all:
 * it produces a confident number about the wrong game.
 */
export function createHypothesisPanel(): HypothesisPanel {
  const root = document.createElement('div')
  root.className = 'fit'

  const title = document.createElement('h2')
  title.className = 'fit__title'
  title.dataset['i18n'] = 'stats.fit'

  const body = document.createElement('div')
  body.className = 'fit__body'

  const empty = document.createElement('p')
  empty.className = 'fit__empty'
  empty.dataset['i18n'] = 'hist.empty'

  root.append(title, empty, body)

  function render(history: History): void {
    if (history.entries.length === 0) {
      // Every statistic below throws on an empty history rather than inventing
      // a number, so the panel says it has nothing instead of showing zeroes
      // that look like a result.
      empty.hidden = false
      body.replaceChildren()
      return
    }
    empty.hidden = true
    body.replaceChildren(
      card('stats.parityTest', chiSquareAgainst(history.entries, EUROPEAN, parityBins())),
      card('stats.numbersTested', chiSquareAgainst(history.entries, EUROPEAN, pocketBins(EUROPEAN))),
      transitionCard(transitionMatrix(history.entries, EUROPEAN, classifyByColour)),
      deviationList(history),
    )
  }

  return { element: root, render }
}