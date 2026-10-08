import type { Pocket, VariantId } from './wheels.js'
import { colourOf, getWheel } from './wheels.js'

/**
 * Bet types, expressed as pure coverage predicates.
 *
 * Every bet is defined by two facts: which pockets win, and what it pays. Both
 * are data here rather than branching logic in a settlement function, so the
 * encyclopedia can render the published table straight from this source and a
 * payout bug cannot hide in an unhandled branch.
 *
 * `payout` is expressed as "to 1": the profit returned per unit staked, not
 * the amount returned including the stake. A straight-up bet paying 35:1 means
 * a winning unit returns 36 in total. This convention is the single most common
 * source of error in roulette code, so it is named and tested explicitly.
 */

export type BetKind =
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'line'
  | 'column'
  | 'dozen'
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | 'low'
  | 'high'

export interface BetSpec {
  readonly kind: BetKind
  /** Profit per unit staked, e.g. 35 for a straight-up. */
  readonly payout: number
  /** How many pockets of a full wheel win this bet. */
  readonly covers: number
}

/**
 * An even-money bet wins on half the pockets of a fair wheel. The five losing
 * pockets on the American wheel versus one on the European is the entire
 * origin of the house edge, and it is why `covers` alone is not the same as
 * `covers / pockets`.
 */
const EVEN_MONEY = 1

export const BETS: Record<BetKind, BetSpec> = {
  straight: { kind: 'straight', payout: 35, covers: 1 },
  split: { kind: 'split', payout: 17, covers: 2 },
  street: { kind: 'street', payout: 11, covers: 3 },
  corner: { kind: 'corner', payout: 8, covers: 4 },
  line: { kind: 'line', payout: 5, covers: 6 },
  column: { kind: 'column', payout: 2, covers: 12 },
  dozen: { kind: 'dozen', payout: 2, covers: 12 },
  red: { kind: 'red', payout: EVEN_MONEY, covers: 18 },
  black: { kind: 'black', payout: EVEN_MONEY, covers: 18 },
  odd: { kind: 'odd', payout: EVEN_MONEY, covers: 18 },
  even: { kind: 'even', payout: EVEN_MONEY, covers: 18 },
  low: { kind: 'low', payout: EVEN_MONEY, covers: 18 },
  high: { kind: 'high', payout: EVEN_MONEY, covers: 18 },
}

export const BET_KINDS: readonly BetKind[] = [
  'straight', 'split', 'street', 'corner', 'line', 'column', 'dozen',
  'red', 'black', 'odd', 'even', 'low', 'high',
]

/**
 * A placed bet: the kind, plus the parameters that select its pockets. Bets
 * that name numbers carry them in `numbers`; column and dozen bets carry an
 * index.
 */
export interface BetPlacement {
  readonly kind: BetKind
  /** Pockets named by a straight-up, split, street, corner or line bet. */
  readonly numbers?: readonly Pocket[]
  /** Column 1-3, or dozen 1-3. */
  readonly group?: number
}

/** The pocket list of a wheel, for exhaustive enumeration. */
export function pocketsOf(variant: VariantId): readonly Pocket[] {
  return getWheel(variant).pockets
}

/** True when this pocket is a zero, which loses every outside bet. */
export function isZero(pocket: Pocket): boolean {
  return pocket === 0
}

/**
 * True when the placement wins on this pocket. Pure: no state, no randomness,
 * no DOM. The product's honesty rests on this function being complete, so it is
 * exhaustively tested rather than spot-checked.
 */
export function covers(placement: BetPlacement, pocket: Pocket): boolean {
  const named = placement.numbers
  switch (placement.kind) {
    case 'straight':
    case 'split':
    case 'street':
    case 'corner':
    case 'line':
      return named !== undefined && named.includes(pocket)

    case 'column': {
      if (isZero(pocket) || placement.group === undefined) return false
      // Columns read left to right: column 1 is 1, 4, 7, 10, ...
      return ((pocket - 1) % 3) + 1 === placement.group
    }

    case 'dozen': {
      if (isZero(pocket) || placement.group === undefined) return false
      return Math.floor((pocket - 1) / 12) + 1 === placement.group
    }

    case 'low':
      return pocket >= 1 && pocket <= 18

    case 'high':
      return pocket >= 19 && pocket <= 36

    case 'red':
      return !isZero(pocket) && colourOf(pocket) === 'red'

    case 'black':
      return !isZero(pocket) && colourOf(pocket) === 'black'

    case 'odd':
      return !isZero(pocket) && pocket % 2 === 1

    case 'even':
      return !isZero(pocket) && pocket % 2 === 0

    default: {
      const exhaustive: never = placement.kind
      throw new Error(`unhandled bet kind: ${String(exhaustive)}`)
    }
  }
}

/**
 * How many pockets a placement actually wins, computed by enumeration rather
 * than trusted from the table. The board uses this to label each area, and the
 * tests assert that the enumeration matches the published count — a mismatch
 * would mean the printed table and the settlement disagree.
 */
export function countCovered(placement: BetPlacement, variant: VariantId): number {
  let total = 0
  for (const pocket of pocketsOf(variant)) {
    if (covers(placement, pocket)) total += 1
  }
  return total
}