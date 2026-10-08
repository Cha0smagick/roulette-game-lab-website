import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextAutoplayAction } from '../src/game/autoplay.js'
import { INITIAL_TABLE, type TableState } from '../src/game/table.js'
import type { PlacedBet } from '../src/roulette/settle.js'

const bet: PlacedBet = { id: 'red', placement: { kind: 'red' }, stake: 5 }

function table(overrides: Partial<TableState>): TableState {
  return { ...INITIAL_TABLE, ...overrides }
}

function locale(name: string): string {
  return readFileSync(new URL(`../src/i18n/locales/${name}.ts`, import.meta.url), 'utf8')
}

describe('the autoplay decision', () => {
  it('waits for every tick while the wheel is still turning', () => {
    expect(nextAutoplayAction(table({ bets: [bet] }), true)).toBe('wait')
    expect(nextAutoplayAction(table({ lastBets: [bet] }), true)).toBe('wait')
    expect(nextAutoplayAction(table({}), true)).toBe('wait')
  })

  it('spins while the current bets are on the felt', () => {
    expect(nextAutoplayAction(table({ bets: [bet] }), false)).toBe('spin')
  })

  it('repeats the settled bets when the balance covers them', () => {
    expect(nextAutoplayAction(table({ lastBets: [bet], balance: 10 }), false)).toBe('rebet')
  })

  it('stops rather than stake what the balance does not hold', () => {
    expect(nextAutoplayAction(table({ lastBets: [bet], balance: 4 }), false)).toBe('stop')
  })

  it('stops when there is nothing left to repeat', () => {
    expect(nextAutoplayAction(table({}), false)).toBe('stop')
  })

  it('is named in both locales', () => {
    for (const name of ['en', 'es']) {
      const file = locale(name)
      expect(file).toContain("'table.autoplay'")
      expect(file).toContain("'table.autoplayStop'")
    }
  })
})
