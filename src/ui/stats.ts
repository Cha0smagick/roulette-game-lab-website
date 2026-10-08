import { t } from '../i18n/index.js'
import type { TranslationKey } from '../i18n/index.js'
import { colourOf, type PocketColour } from '../roulette/wheels.js'
import { statsFor, type History, type HistoryStats } from '../roulette/history.js'

/**
 * Observed counts over the recorded history: how many spins, the current
 * colour run, the current repeat, and which pockets have been seen most and
 * least often.
 *
 * This is the part of the site most likely to be misread, so it carries a
 * caption saying plainly that these are observations and not signals. The
 * words "hot" and "cold" are deliberately absent from the visible labels even
 * though the engine exposes `hot` and `cold`: a label is a promise about what
 * the next spin will do, and these numbers make no such promise. The engine
 * field names survive because they are internal.
 *
 * The rates a fair wheel predicts are deliberately NOT computed here. That is
 * G2's job, and until it lands the honest presentation is the raw count with an
 * explicit disclaimer rather than a count dressed as a conclusion.
 */

/** Enough numbers to notice a pattern, few enough to stay on one line. */
const MAX_LISTED = 6

const COLOUR_KEY: Record<PocketColour, TranslationKey> = {
  red: 'common.colour.red',
  black: 'common.colour.black',
  green: 'common.colour.green',
}

export interface StatsPanel {
  readonly element: HTMLElement
  render(history: History): void
}

/** `statsFor` asks whether a pocket is red; the wheel already knows. */
const isRed = (pocket: number): boolean => colourOf(pocket) === 'red'

function listNumbers(values: readonly number[]): string {
  if (values.length === 0) {
    return t('stats.none')
  }
  const shown = values.slice(0, MAX_LISTED).map(String)
  const rest = values.length - shown.length
  return rest > 0 ? `${shown.join(', ')} +${String(rest)}` : shown.join(', ')
}

function row(labelKey: TranslationKey): { term: HTMLElement; value: HTMLElement } {
  const term = document.createElement('dt')
  term.className = 'stats__label'
  term.setAttribute('data-i18n', labelKey)
  const value = document.createElement('dd')
  value.className = 'stats__value'
  return { term, value }
}

function colourRunText(stats: HistoryStats): string {
  const run = stats.colourRun
  if (run === null) {
    return t('stats.none')
  }
  return `${t(COLOUR_KEY[run.colour])} ${t('stats.inARow', { count: String(run.length) })}`
}

function pocketStreakText(stats: HistoryStats): string {
  const streak = stats.streak
  if (streak === null) {
    return t('stats.none')
  }
  return `${String(streak.pocket)} ${t('stats.inARow', { count: String(streak.length) })}`
}

export function createStatsPanel(): StatsPanel {
  const root = document.createElement('div')
  root.className = 'stats'

  const heading = document.createElement('h2')
  heading.className = 'stats__title'
  heading.setAttribute('data-i18n', 'stats.title')

  const list = document.createElement('dl')
  list.className = 'stats__list'
  const total = row('stats.total')
  const colourRun = row('stats.colourRun')
  const pocketStreak = row('stats.pocketStreak')
  const hottest = row('stats.hottest')
  const coldest = row('stats.coldest')
  list.append(
    total.term,
    total.value,
    colourRun.term,
    colourRun.value,
    pocketStreak.term,
    pocketStreak.value,
    hottest.term,
    hottest.value,
    coldest.term,
    coldest.value,
  )

  const caption = document.createElement('p')
  caption.className = 'stats__caption'
  caption.setAttribute('data-i18n', 'stats.caption')

  root.append(heading, list, caption)

  function render(history: History): void {
    const stats = statsFor(history, isRed)
    total.value.textContent = String(stats.total)
    colourRun.value.textContent = colourRunText(stats)
    pocketStreak.value.textContent = pocketStreakText(stats)
    hottest.value.textContent = listNumbers(stats.hot)
    coldest.value.textContent = listNumbers(stats.cold)
  }

  return { element: root, render }
}