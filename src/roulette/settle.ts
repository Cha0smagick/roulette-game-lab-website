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

export function settle(bets: readonly PlacedBet[], outcome: Pocket): Settlement {
  let returned = 0
  let wagered = 0
  const winners: Winner[] = []

  for (const bet of bets) {
    wagered += bet.stake
    if (!covers(bet.placement, outcome)) continue
    const profit = bet.stake * BETS[bet.placement.kind].payout
    const betReturn = bet.stake + profit
    returned += betReturn
    winners.push({ id: bet.id, returned: betReturn, profit })
  }

  return { returned, wagered, net: returned - wagered, winners }
}

/** Total currently on the felt. */
export function totalStake(bets: readonly PlacedBet[]): number {
  let sum = 0
  for (const bet of bets) sum += bet.stake
  return sum
}