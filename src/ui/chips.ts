/**
 * Chip denominations as real buttons.
 *
 * Every control on this table is a `<button>` rather than a styled `<div>`:
 * a phone player with reduced dexterity gets keyboard focus, a screen reader
 * announces the value, and Enter/Space work without any bespoke key handling.
 */

import { CHIPS, type ChipValue } from '../game/table.js'
import { t } from '../i18n/index.js'

export interface ChipPicker {
  readonly element: HTMLElement
  /** Re-render pressed and affordable states after a state change. */
  render(selected: ChipValue, balance: number): void
}

export function createChipPicker(onPick: (chip: ChipValue) => void): ChipPicker {
  const group = document.createElement('div')
  group.className = 'chips'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', t('chip.select'))

  const buttons = new Map<ChipValue, HTMLButtonElement>()

  for (const value of CHIPS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    button.dataset['chip'] = String(value)
    // The visible text is the denomination, which is also a complete accessible
    // name: the group label supplies "Chip" and the button supplies "25".
    button.setAttribute('data-i18n', `chip.${value}`)
    button.addEventListener('click', () => {
      onPick(value)
    })
    buttons.set(value, button)
    group.append(button)
  }

  return {
    element: group,
    render(selected, balance) {
      for (const [value, button] of buttons) {
        const isSelected = value === selected
        button.classList.toggle('chip--selected', isSelected)
        // aria-pressed is the same fact the visual ring conveys, stated in a
        // form a screen reader can report.
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false')
        // An unaffordable chip stays visible but disabled. Hiding it would make
        // the row reflow under a thumb that is already aimed at it.
        button.disabled = value > balance
      }
    },
  }
}