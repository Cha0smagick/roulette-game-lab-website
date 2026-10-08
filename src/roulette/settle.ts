import type { Pocket } from './wheels.js'
import type { BetPlacement } from './bets.js'
import { BETS, covers } from './bets.js'

/**
 * Settlement: turn a set of placed bets and a winning pocket into money.
 *
 * `stake` is the amount on the felt. A winning bet returns `stake` plus the
 * profit, so a 35:1 straight-up with a 1 unit stake returns 36. A losing bet
 * returns nothing. There is no push in roulette — a bet either covers the
 * pocket or it does not — and modelling one would be a fiction.
 */

export interface PlacedBet {
  readonly id: string
  readonly placement: BetPlacement
  readonly stake: number
}

export interface Winner {
  readonly id: string
  /** Stake plus profit. */
  readonly returned: number
  /** Profit on this bet alone, excluding the stake. */
  readonly profit: number
}

export interface Settlement {
  /** Total returned to the player across every bet, profit included. */
  readonly returned: number
  /** Total staked. */
  readonly wagered: number
  /** `returned - wagered`: negative means the house won the spin. */
  readonly net: number
  /** Payouts for the bets that won, for the UI to highlight. */
  readonly winners: readonly Winner[]
}

/**
 * One bet, one pocket, no containers.
 *
 * Exists because the simulator runs millions of single-bet rounds and
 * allocating a `PlacedBet[]`, a `Settlement` and a `Winner[]` for each one
 * would dominate its runtime. `net` is profit: a winning bet returns the stake
 * plus the profit, so `net` is `returned - stake`, which is the profit.
 *
 * `settle` below delegates here, so there is exactly one implementation of the
 * payout arithmetic in the codebase and the simulator cannot drift away from
 * what the live table pays.
 */
export interface SingleResult {
  /** Profit on this bet. Zero for a losing bet. */
  readonly net: number
  readonly won: boolean
  readonly profit: number
}

export function settleOne(placement: BetPlacement, stake: number, outcome: Pocket): SingleResult {
  if (!covers(placement, outcome)) return { net: -stake, won: false, profit: 0 }
  const profit = stake * BETS[placement.kind].payout
  return { net: profit, won: true, profit }
}

export function settle(bets: readonly PlacedBet[], outcome: Pocket): Settlement {
  let returned = 0
  let wagered = 0
  const winners: Winner[] = []

  for (const bet of bets) {
    wagered += bet.stake
    const one = settleOne(bet.placement, bet.stake, outcome)
    if (!one.won) continue
    const betReturn = bet.stake + one.profit
    returned += betReturn
    winners.push({ id: bet.id, returned: betReturn, profit: one.profit })
  }

  return { returned, wagered, net: returned - wagered, winners }
}

/** Total currently on the felt. */
export function totalStake(bets: readonly PlacedBet[]): number {
  let sum = 0
  for (const bet of bets) sum += bet.stake
  return sum
}