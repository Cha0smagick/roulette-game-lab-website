import type { Pocket } from './wheels.js'

/**
 * Spin history and the descriptive statistics a table shows.
 *
 * These are the numbers players use to build false confidence — "red is due".
 * They are computed honestly and labelled as descriptive: the wheel has no
 * memory, so a streak of reds changes nothing about the next spin. The
 * simulator exists to demonstrate exactly that, so the table must not imply
 * otherwise.
 */

export const HISTORY_LIMIT = 100

export interface History {
  /** Most recent first, capped at HISTORY_LIMIT. */
  readonly entries: readonly Pocket[]
}

export const EMPTY_HISTORY: History = { entries: [] }

export function pushOutcome(history: History, pocket: Pocket): History {
  const entries = [pocket, ...history.entries]
  return {
    entries: entries.length > HISTORY_LIMIT ? entries.slice(0, HISTORY_LIMIT) : entries,
  }
}

export interface PocketStat {
  readonly pocket: Pocket
  readonly count: number
}

export interface ColourRun {
  readonly colour: 'red' | 'black'
  readonly length: number
}

export interface HistoryStats {
  readonly total: number
  /** Pockets seen, most frequent first, ties broken by number. */
  readonly counts: readonly PocketStat[]
  readonly hot: readonly Pocket[]
  readonly cold: readonly Pocket[]
  /** Current run of one repeated pocket, if any. */
  readonly streak: { pocket: Pocket; length: number } | null
  /** The leading run of reds or blacks, which stops at a zero or a colour change. */
  readonly colourRun: ColourRun | null
}

export function statsFor(
  history: History,
  isRed: (pocket: Pocket) => boolean,
): HistoryStats {
  const tally = new Map<Pocket, number>()
  for (const pocket of history.entries) {
    tally.set(pocket, (tally.get(pocket) ?? 0) + 1)
  }

  const counts = [...tally.entries()]
    .map(([pocket, count]) => ({ pocket, count }))
    .sort((a, b) => b.count - a.count || a.pocket - b.pocket)

  const leader = counts[0]
  const hot = leader === undefined ? [] : counts.filter((s) => s.count === leader.count).map((s) => s.pocket)
  const cold = counts.filter((s) => s.count === 1).map((s) => s.pocket)

  const head = history.entries[0]
  let streak: HistoryStats['streak'] = null
  if (head !== undefined) {
    let length = 1
    while (length < history.entries.length && history.entries[length] === head) length += 1
    if (length > 1) streak = { pocket: head, length }
  }

  return {
    total: history.entries.length,
    counts,
    hot,
    cold,
    streak,
    colourRun: leadingColourRun(history, isRed),
  }
}

/**
 * Length of the run of reds or blacks starting at the most recent spin. A zero
 * stops it: a red run cannot chain through a green pocket, so the measurement
 * must not pretend otherwise.
 */
function leadingColourRun(
  history: History,
  isRed: (pocket: Pocket) => boolean,
): ColourRun | null {
  const head = history.entries[0]
  if (head === undefined || head === 0) return null
  const colour: 'red' | 'black' = isRed(head) ? 'red' : 'black'
  let length = 1
  while (length < history.entries.length) {
    const pocket = history.entries[length]
    if (pocket === undefined || pocket === 0) break
    if ((isRed(pocket) ? 'red' : 'black') !== colour) break
    length += 1
  }
  return { colour, length }
}

/** Read a history back out of storage, tolerating absent or corrupt data. */
export function parseHistory(raw: string | null): History {
  if (raw === null) return EMPTY_HISTORY
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_HISTORY
    const entries = parsed.filter(
      (value): value is Pocket => typeof value === 'number' && Number.isFinite(value),
    )
    return { entries: entries.slice(0, HISTORY_LIMIT) }
  } catch {
    return EMPTY_HISTORY
  }
}

export function serializeHistory(history: History): string {
  return JSON.stringify(history.entries)
}