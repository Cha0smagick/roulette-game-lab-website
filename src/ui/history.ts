import { t } from '../i18n/index.js'
import type { TranslationKey } from '../i18n/index.js'
import { colourOf, type Pocket, type PocketColour } from '../roulette/wheels.js'
import type { History } from '../roulette/history.js'

/**
 * The last-N spin strip.
 *
 * A wheel has no memory, so this strip is not evidence of anything. It exists
 * because a player watches their own spins, and a tool that hides them is a
 * tool that cannot be checked. Its honesty comes from what it does NOT do: no
 * highlighting of repeats, no "due" marks, no colour that implies one pocket is
 * warmer than another. Every cell is the pocket, its colour, and nothing else.
 *
 * Cells are pooled and re-used rather than rebuilt per spin. A strip of a
 * hundred cells rebuilt on every spin churns a hundred nodes for a change in
 * at most one, which is exactly the kind of cost that makes a page feel heavy
 * on a mid-range phone while giving the visitor nothing.
 */

const COLOUR_KEY: Record<PocketColour, TranslationKey> = {
  red: 'common.colour.red',
  black: 'common.colour.black',
  green: 'common.colour.green',
}

export interface HistoryStrip {
  readonly element: HTMLElement
  render(history: History): void
}

export function createHistoryStrip(): HistoryStrip {
  const list = document.createElement('ol')
  list.className = 'hist'
  list.setAttribute('data-i18n-attr', 'aria-label:table.history')

  const caption = document.createElement('p')
  caption.className = 'hist__caption'
  caption.setAttribute('data-i18n', 'hist.newest')

  const empty = document.createElement('li')
  empty.className = 'hist__empty'
  empty.setAttribute('data-i18n', 'hist.empty')

  const cells: HTMLLIElement[] = []

  function render(history: History): void {
    const entries = history.entries

    if (entries.length === 0) {
      for (const cell of cells) {
        cell.hidden = true
      }
      empty.hidden = false
      list.replaceChildren(empty)
      return
    }

    while (cells.length < entries.length) {
      const cell = document.createElement('li')
      cell.className = 'hist__cell'
      cells.push(cell)
    }
    if (empty.hidden === false) {
      empty.hidden = true
    }

    const nodes: HTMLElement[] = []
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i]
      if (cell === undefined) {
        continue
      }
      const pocket: Pocket | undefined = entries[i]
      if (pocket === undefined) {
        cell.hidden = true
        continue
      }
      const colour = colourOf(pocket)
      cell.hidden = false
      cell.dataset['colour'] = colour
      cell.textContent = String(pocket) // i18n-exempt: pocket number as printed on felt
      cell.setAttribute(
        'aria-label',
        t('hist.cell', { number: String(pocket), colour: t(COLOUR_KEY[colour]) }),
      )
      nodes.push(cell)
    }
    list.replaceChildren(...nodes)
  }

  const root = document.createElement('div')
  root.className = 'hist__wrap'
  root.append(caption, list)
  return { element: root, render }
}