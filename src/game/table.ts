/**
 * The live table's state machine. Pure: no DOM, no timers, no randomness.
 *
 * The outcome of a spin arrives as an action argument rather than being drawn
 * here, because `pickPocket` in roulette/wheels is the single place a number
 * is ever chosen. If this module could draw, the table and the simulation page
 * could disagree about what a seed means.
 */

import type { BetPlacement } from '../roulette/bets.js'
import { totalStake, settle } from '../roulette/settle.js'
import type { PlacedBet, Settlement } from '../roulette/settle.js'
import type { Pocket } from '../roulette/wheels.js'

/**
 * Chip denominations. Ascending so the picker reads left to right in
 * increasing order of commitment, and matching the `chip.1|5|25|100` keys.
 */
export const CHIPS = [1, 5, 25, 100] as const

export type ChipValue = (typeof CHIPS)[number]

/**
 * A bankroll, not a credit line. It bounds the game without any rule about
 * maximum exposure, because a player can never stake more than they hold: that
 * single invariant makes a separate table limit redundant here.
 */
export const STARTING_BALANCE = 1000

export interface TableState {
  readonly balance: number
  readonly chip: ChipValue
  /** At most one record per distinct placement; repeated taps stack onto it. */
  readonly bets: readonly PlacedBet[]
  /** The bets settled by the last spin, kept so `rebet` can repeat them. */
  readonly lastBets: readonly PlacedBet[]
  readonly lastSettlement: Settlement | null
  readonly lastOutcome: Pocket | null
}

export const INITIAL_TABLE: TableState = {
  balance: STARTING_BALANCE,
  chip: CHIPS[1],
  bets: [],
  lastBets: [],
  lastSettlement: null,
  lastOutcome: null,
}

export type TableAction =
  | { readonly type: 'set-chip'; readonly chip: ChipValue }
  | { readonly type: 'place'; readonly placement: BetPlacement }
  | { readonly type: 'clear' }
  | { readonly type: 'undo' }
  | { readonly type: 'rebet' }
  | { readonly type: 'spin'; readonly outcome: Pocket }
  | { readonly type: 'reset' }

/**
 * A stable identity for a placement, used as the bet id.
 *
 * Numbers are sorted so `[17, 18]` and `[18, 17]` are the same bet, which
 * matters because the board can offer either adjacency of a split depending on
 * which cell the player pressed.
 */
export function placementKey(placement: BetPlacement): string {
  if (placement.numbers !== undefined) {
    const ordered = [...placement.numbers].sort((a, b) => a - b)
    return `${placement.kind}:${ordered.join(',')}`
  }
  return `${placement.kind}:${placement.group ?? ''}`
}

/**
 * Bet kinds that name pockets, and therefore cannot exist without them.
 *
 * Without this rule a straight-up with no numbers is structurally acceptable,
 * covers nothing, and quietly burns the stake on every spin -- a bet the player
 * never knowingly made.
 */
const NUMBER_KINDS: readonly string[] = ['straight', 'split', 'street', 'corner', 'line']

/**
 * Structural guard against nonsense placements, not a per-variant restriction.
 *
 * Pocket values run 0 to 36 on every wheel; the American double zero shares the
 * value 0 and is distinguished by position, so it needs no separate value here.
 * Whether a placement wins is settled by `covers`, not by this check -- a bet
 * that names pockets the current wheel does not carry simply never wins.
 */
export function isLegal(placement: BetPlacement): boolean {
  if (NUMBER_KINDS.includes(placement.kind)) {
    if (placement.numbers === undefined || placement.numbers.length === 0) return false
  }
  if (placement.numbers !== undefined) {
    if (placement.numbers.length === 0) return false
    return placement.numbers.every(
      (pocket) => Number.isInteger(pocket) && pocket >= 0 && pocket <= 36,
    )
  }
  if (placement.kind === 'column' || placement.kind === 'dozen') {
    return (
      placement.group !== undefined &&
      Number.isInteger(placement.group) &&
      placement.group >= 1 &&
      placement.group <= 3
    )
  }
  return true
}

export function reduce(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'set-chip':
      return state.chip === action.chip ? state : { ...state, chip: action.chip }

    case 'place':
      return place(state, action.placement)

    case 'clear': {
      if (state.bets.length === 0) return state
      return { ...state, balance: state.balance + totalStake(state.bets), bets: [] }
    }

    case 'undo': {
      const last = state.bets[state.bets.length - 1]
      if (last === undefined) return state
      return {
        ...state,
        balance: state.balance + last.stake,
        bets: state.bets.slice(0, -1),
      }
    }

    case 'rebet': {
      // All or nothing. A partial rebet would silently drop bets the player
      // asked to repeat, which is worse than refusing and saying so.
      const total = totalStake(state.lastBets)
      if (state.lastBets.length === 0 || state.balance < total) return state
      return { ...state, balance: state.balance - total, bets: state.lastBets }
    }

    case 'spin': {
      const settlement = settle(state.bets, action.outcome)
      return {
        ...state,
        // `net` can never exceed the stake plus winnings already deducted, so
        // the balance cannot be driven negative by a win.
        balance: state.balance + settlement.net,
        lastBets: state.bets,
        lastSettlement: settlement,
        lastOutcome: action.outcome,
        bets: [],
      }
    }

    case 'reset':
      return { ...INITIAL_TABLE, chip: state.chip }
  }
}

function place(state: TableState, placement: BetPlacement): TableState {
  if (!isLegal(placement)) return state
  // The bankroll is the whole limit: a player can never stake what they do not
  // hold, so the balance is structurally non-negative.
  if (state.balance < state.chip) return state

  const id = placementKey(placement)
  const existing = state.bets.find((bet) => bet.id === id)
  const bets =
    existing === undefined
      ? [...state.bets, { id, placement, stake: state.chip }]
      : state.bets.map((bet) => (bet.id === id ? { ...bet, stake: bet.stake + state.chip } : bet))

  return { ...state, balance: state.balance - state.chip, bets }
}

/** Total currently at risk, for the HUD. */
export function pendingWager(state: TableState): number {
  return totalStake(state.bets)
}

/** False when the player cannot afford even one chip. */
export function canPlace(state: TableState): boolean {
  return state.balance >= state.chip
}

export function hasBets(state: TableState): boolean {
  return state.bets.length > 0
}

/** The bet on a given placement, for painting a chip on the board. */
export function betOn(state: TableState, placement: BetPlacement): PlacedBet | null {
  const id = placementKey(placement)
  return state.bets.find((bet) => bet.id === id) ?? null
}