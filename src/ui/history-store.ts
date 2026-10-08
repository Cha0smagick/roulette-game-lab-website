import {
  parseHistory,
  pushOutcome,
  serializeHistory,
  type History,
} from '../roulette/history.js'
import type { Pocket } from '../roulette/wheels.js'

/**
 * Persistence for the live spin history.
 *
 * This is the first consumer of the serialisation that `roulette/history.ts`
 * has always exposed and nothing had yet used. The reason it exists at all is
 * that the analysis page is a separate document from the table: without a
 * shared store the two pages would each hold a different half of the same
 * story, and a page whose numbers cannot survive a navigation is not analysis.
 *
 * Storage is not assumed to work. A phone in private mode can throw on write,
 * a browser can refuse the read, and a quota error is a normal outcome rather
 * than an exceptional one. Every access is therefore wrapped, and a failed
 * store degrades to "no history" rather than taking the page down with it --
 * which matters here because the failure would be invisible otherwise.
 */

/**
 * Exported rather than module-private because a storage key that no test can
 * read is a key nobody can prove is stable. Renaming it would silently orphan
 * every history a player already had, and nothing else in the repository would
 * notice.
 */
export const HISTORY_STORAGE_KEY = 'roulette-lab.history'

export function loadHistory(): History {
  try {
    return parseHistory(globalThis.localStorage.getItem(HISTORY_STORAGE_KEY))
  } catch {
    return parseHistory(null)
  }
}

export function saveHistory(history: History): void {
  try {
    globalThis.localStorage.setItem(HISTORY_STORAGE_KEY, serializeHistory(history))
  } catch {
    // A store that refuses the write must not interrupt a spin. The history is
    // still correct in memory for as long as this page stays open.
  }
}

/** Record one outcome and persist it. Returns the new history to render. */
export function recordOutcome(history: History, pocket: Pocket): History {
  const next = pushOutcome(history, pocket)
  saveHistory(next)
  return next
}