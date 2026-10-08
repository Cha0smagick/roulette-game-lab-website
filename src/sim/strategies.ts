import type { TranslationKey } from '../i18n/locales/en.js'
import type { BetKind, BetPlacement } from '../roulette/bets.js'
import type { VariantId } from '../roulette/wheels.js'

/**
 * Betting systems, as pure generators.
 *
 * The claim this module has to earn is that a system cannot beat a negative
 * expectation. Every strategy here therefore plays the same game a casino
 * offers, and the engine measures what actually happens rather than trusting
 * any theory about what should happen. A system that could turn a losing game
 * into a winning one would show up as a positive EV, and no such result
 * appears on a wheel with a zero.
 *
 * Pure on purpose: a system is data plus two functions, so a system can be
 * tested without a wheel, a bankroll or a DOM. `advance` folds the previous
 * result in, `plan` produces the next bet, and neither sees the RNG.
 *
 * All progression amounts are counted in UNITS of `minBet`. The engine
 * converts a unit count into a stake once, at the end of `plan`. Counting in
 * units rather than currency is what makes the table-limit clamp and the
 * bankroll arithmetic exact integer operations with no rounding drift.
 */

export const STRATEGY_IDS = [
  'flat',
  'martingale',
  'reverseMartingale',
  'labouchere',
  'fibonacci',
  'dAlembert',
  'oscarGrind',
  'columnProgression',
] as const

export type StrategyId = (typeof STRATEGY_IDS)[number]

/** State a system carries between spins. */
export interface StrategyRun {
  readonly bankroll: number
  /** Total staked so far, counted at the moment of staking. */
  readonly wagered: number
  readonly spins: number
  /** Consecutive losses at the current size. */
  readonly losses: number
  /** Consecutive wins at the current size. */
  readonly wins: number
  /** Labouchere's working list of unit counts. */
  readonly sequence: readonly number[]
  /**
   * Oscar Grind's outstanding cycle profit, in units. Read as "the current
   * column to bet" by the column progression, which is the only other system
   * with a position rather than just a size.
   */
  readonly cycle: number
  readonly minBet: number
  readonly maxBet: number
}

export interface BetPlan {
  readonly placement: BetPlacement
  readonly stake: number
}

export interface Strategy {
  readonly id: StrategyId
  /** Bet to place on the next spin. `run` already reflects every prior result. */
  plan(run: StrategyRun, variant: VariantId): BetPlan
  /** Fold the spin just played back into the run. */
  advance(run: StrategyRun, won: boolean): StrategyRun
}

/** The working list Labouchere starts from: five units to win five units. */
const LABOUCHERE_SEQUENCE: readonly number[] = [1, 1, 1, 1, 1]

/**
 * Fibonacci numbers indexed from zero, extended on demand.
 *
 * A fixed table would silently stop the progression at the table limit's worth
 * of losses and then hold there, which looks like a clamp but is not one.
 */
function fibonacciAt(index: number): number {
  let a = 1
  let b = 1
  for (let i = 0; i < index; i += 1) {
    const next = a + b
    a = b
    b = next
    if (!Number.isSafeInteger(b)) return Number.MAX_SAFE_INTEGER
  }
  return a
}

/**
 * Convert a unit count into a stake that respects both the table limits and
 * the money on hand.
 *
 * The table limit is a hard clamp. The bankroll is NOT clamped: a system that
 * demands more than the player holds is what ruins them, and hiding that
 * behind a "bet what you can afford" rule would delete the single most
 * instructive result the simulator can show.
 */
function stakeOf(units: number, run: StrategyRun): number {
  const raw = units * run.minBet
  if (raw < run.minBet) return run.minBet
  if (raw > run.maxBet) return run.maxBet
  return raw
}

/** Even money, which is the bet every classic progression is defined on. */
function evenMoney(kind: BetKind): BetPlacement {
  return { kind }
}

const advanceWith = (
  run: StrategyRun,
  patch: { losses?: number; wins?: number; sequence?: readonly number[]; cycle?: number },
): StrategyRun => ({
  ...run,
  losses: patch.losses ?? run.losses,
  wins: patch.wins ?? run.wins,
  sequence: patch.sequence ?? run.sequence,
  cycle: patch.cycle ?? run.cycle,
})

/**
 * Flat: one unit, forever.
 *
 * Included because it is the control. Every other system exists to be
 * compared against a system that never raises, and if a system beats flat the
 * comparison has to be able to fail.
 */
const flat: Strategy = {
  id: 'flat',
  plan: (run) => ({ placement: evenMoney('red'), stake: stakeOf(1, run) }),
  advance: (run, won) => advanceWith(run, { losses: won ? 0 : run.losses + 1, wins: won ? run.wins + 1 : 0 }),
}

/**
 * Martingale: double after every loss, reset after a win.
 *
 * The system requires unlimited capital and an unlimited table. Give it both
 * and it still loses the house edge on every spin; take either away and it
 * ends the session. The engine varies the table limit precisely so that this
 * shows up rather than being argued about.
 */
const martingale: Strategy = {
  id: 'martingale',
  plan: (run) => ({
    placement: evenMoney('red'),
    stake: stakeOf(Math.pow(2, run.losses), run),
  }),
  advance: (run, won) => advanceWith(run, { losses: won ? 0 : run.losses + 1, wins: won ? run.wins + 1 : 0 }),
}

/**
 * Reverse Martingale: double after every win, reset after a loss.
 *
 * Called Paroli. It asks less of the bankroll than Martingale at the same
 * target profit, and it is ruinous in the same way at a lower ceiling.
 */
const reverseMartingale: Strategy = {
  id: 'reverseMartingale',
  plan: (run) => ({
    placement: evenMoney('red'),
    stake: stakeOf(Math.pow(2, run.wins), run),
  }),
  advance: (run, won) => advanceWith(run, { losses: won ? 0 : run.losses + 1, wins: won ? run.wins + 1 : 0 }),
}

/**
 * Labouchere: bet the sum of the first and last entry of a working list.
 * Cross the pair off on a win, append a unit on a loss, and restart when the
 * list runs down. The list is empty or a single entry at completion.
 *
 * The list is rebuilt with `slice` on each result, which is why this is the
 * most allocation-hungry of the eight. That is acceptable because the engine
 * runs inside a Worker and one small array per spin does not block the page.
 */
const labouchere: Strategy = {
  id: 'labouchere',
  plan: (run) => {
    const first = run.sequence[0] ?? 1
    const last = run.sequence[run.sequence.length - 1] ?? first
    return { placement: evenMoney('red'), stake: stakeOf(first + last, run) }
  },
  advance: (run, won) => {
    if (!won) {
      return advanceWith(run, { sequence: [...run.sequence, 1], losses: run.losses + 1, wins: 0 })
    }
    const remaining = run.sequence.slice(1, run.sequence.length - 1)
    const sequence = remaining.length === 0 ? [...LABOUCHERE_SEQUENCE] : remaining
    return advanceWith(run, { sequence, losses: 0, wins: run.wins + 1 })
  },
}

/**
 * Fibonacci: step one place along the sequence on a loss, back on a win.
 *
 * Slower and far shallower than Martingale, which is why it survives longer
 * sessions. It loses at exactly the same rate per spin.
 */
const fibonacci: Strategy = {
  id: 'fibonacci',
  plan: (run) => ({
    placement: evenMoney('red'),
    stake: stakeOf(fibonacciAt(run.losses), run),
  }),
  advance: (run, won) => advanceWith(run, { losses: won ? 0 : run.losses + 1, wins: won ? run.wins + 1 : 0 }),
}

/**
 * D'Alembert: one unit up on a loss, one unit down on a win, never below the
 * base unit. Flatter than Martingale, so it survives longer and still ends.
 */
const dAlembert: Strategy = {
  id: 'dAlembert',
  plan: (run) => ({ placement: evenMoney('red'), stake: stakeOf(1 + run.losses - run.wins, run) }),
  advance: (run, won) => advanceWith(run, { losses: won ? 0 : run.losses + 1, wins: won ? run.wins + 1 : 0 }),
}

/**
 * Oscar Grind: recover a one-unit profit with a single bet, and only raise the
 * target once that profit is banked.
 *
 * The distinguishing property is that the stake does not chase losses. A
 * single loss returns the cycle target to its starting unit, which is the
 * entire idea, and it is why this system needs far less bankroll than the ones
 * that double.
 */
const oscarGrind: Strategy = {
  id: 'oscarGrind',
  plan: (run) => ({ placement: evenMoney('red'), stake: stakeOf(run.cycle, run) }),
  advance: (run, won) => {
    if (!won) return advanceWith(run, { cycle: 1, losses: run.losses + 1, wins: 0 })
    const cycle = run.cycle - 1
    return advanceWith(run, { cycle: cycle > 0 ? cycle : 1, losses: 0, wins: run.wins + 1 })
  },
}

/**
 * Column progression: one unit on a column, advancing to the next column on a
 * loss and adding a unit, resetting on a win.
 *
 * The only system here that does not play even money. It is included because a
 * reader who has only ever seen progressions on red/black reasonably suspects
 * the bet type is what matters; the answer is that it is not, and running it
 * on the same wheel is the way to show that rather than assert it.
 */
const columnProgression: Strategy = {
  id: 'columnProgression',
  plan: (run) => ({
    placement: { kind: 'column', group: run.cycle },
    stake: stakeOf(1 + run.losses, run),
  }),
  advance: (run, won) => {
    if (won) return advanceWith(run, { cycle: 1, losses: 0, wins: run.wins + 1 })
    return advanceWith(run, { cycle: (run.cycle % 3) + 1, losses: run.losses + 1, wins: 0 })
  },
}

export const STRATEGIES: Record<StrategyId, Strategy> = {
  flat,
  martingale,
  reverseMartingale,
  labouchere,
  fibonacci,
  dAlembert,
  oscarGrind,
  columnProgression,
}

/**
 * Written out rather than derived, so that adding a system without adding its
 * label fails the build instead of shipping an unlabelled row.
 */
export const STRATEGY_LABEL: Record<StrategyId, TranslationKey> = {
  flat: 'sim.strategy.flat',
  martingale: 'sim.strategy.martingale',
  reverseMartingale: 'sim.strategy.reverseMartingale',
  labouchere: 'sim.strategy.labouchere',
  fibonacci: 'sim.strategy.fibonacci',
  dAlembert: 'sim.strategy.dAlembert',
  oscarGrind: 'sim.strategy.oscarGrind',
  columnProgression: 'sim.strategy.columnProgression',
}

export interface RunSetup {
  readonly bankroll: number
  readonly minBet: number
  readonly maxBet: number
}

export function initialRun(setup: RunSetup): StrategyRun {
  if (!Number.isSafeInteger(setup.bankroll) || setup.bankroll <= 0) {
    throw new RangeError('bankroll must be a positive safe integer')
  }
  if (!Number.isSafeInteger(setup.minBet) || setup.minBet <= 0) {
    throw new RangeError('minBet must be a positive safe integer')
  }
  if (!Number.isSafeInteger(setup.maxBet) || setup.maxBet < setup.minBet) {
    throw new RangeError('maxBet must be a safe integer no smaller than minBet')
  }
  return {
    bankroll: setup.bankroll,
    wagered: 0,
    spins: 0,
    losses: 0,
    wins: 0,
    sequence: [...LABOUCHERE_SEQUENCE],
    cycle: 1,
    minBet: setup.minBet,
    maxBet: setup.maxBet,
  }
}