/**
 * The autoplay decision. Pure: no DOM, no timers, no randomness.
 *
 * The player asks the table to repeat its last bets until they say stop or the
 * balance runs out. The decision lives in one pure function so a test can
 * assert every branch without a canvas, a clock or a wheel: main.ts only runs
 * the decision on a timer and dispatches what it returns.
 *
 * The balance is the whole limit, the same invariant as table.ts: autoplay
 * never stakes money the player does not hold. When the repeat would cost more
 * than the balance, the honest answer is stop, not a partial repeat -- a
 * partial rebet would silently drop bets the player asked to repeat.
 */
import { totalStake } from '../roulette/settle.js'
import { hasBets, type TableState } from './table.js'

export type AutoplayAction = 'spin' | 'rebet' | 'stop' | 'wait'

/**
 * What the autoplay loop should do this tick. `wait` means the wheel is still
 * turning; `stop` means the loop is over -- either there is nothing left to
 * repeat or the balance cannot cover the repeat.
 */
export function nextAutoplayAction(state: TableState, spinning: boolean): AutoplayAction {
  if (spinning) return 'wait'
  if (hasBets(state)) return 'spin'
  if (state.lastBets.length === 0) return 'stop'
  if (state.balance < totalStake(state.lastBets)) return 'stop'
  return 'rebet'
}
