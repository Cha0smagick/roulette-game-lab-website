import type { Pocket, VariantId } from './wheels.js'
import type { BetKind, BetPlacement } from './bets.js'
import { BETS, BET_KINDS, covers, isZero, pocketsOf } from './bets.js'

/**
 * House edge, derived rather than declared.
 *
 * The whole product claims that the arithmetic is honest, so the edge is
 * computed from the same predicates that settle real bets. A hand-written
 * "2.70%" in a table would be an assertion the code never checks; here a
 * change to a payout constant or a coverage predicate immediately moves the
 * number, and the tests fail if it moves to somewhere wrong.
 */

/** Expected net return per unit staked. Negative means the player loses. */
export function expectedNetPerUnit(kind: BetKind, variant: VariantId): number {
  const pockets = pocketsOf(variant)
  let net = 0
  for (const pocket of pockets) {
    net += covers(representativePlacement(kind, variant), pocket)
      ? BETS[kind].payout
      : -1
  }
  return net / pockets.length
}

/** House edge as a positive fraction: 0.027 means 2.7% of every unit staked. */
export function houseEdge(kind: BetKind, variant: VariantId): number {
  return -expectedNetPerUnit(kind, variant)
}

/**
 * The edge for the most common bet, used as the headline figure. Every bet on
 * a given wheel has the same edge; that identity is itself a theorem worth
 * asserting in the test suite rather than assuming.
 */
export function wheelHouseEdge(variant: VariantId): number {
  return houseEdge('red', variant)
}

/**
 * A concrete placement used only to measure coverage.
 *
 * The representative pockets are ordinary numbers, never a zero. On the
 * American wheel the value 0 occupies two pockets, and because bets are
 * expressed as value predicates a straight-up on 0 would cover both of them —
 * measuring that would report a wildly positive edge that no casino offers.
 * The published edge for a straight-up is the one on an ordinary number.
 *
 * This is a real limitation of a value-based model rather than an index-based
 * one, and it is recorded here so nobody later mistakes it for a fair game: a
 * player who could bet each zero separately would still face the same 5.26%.
 */
export function representativePlacement(kind: BetKind, variant: VariantId): BetPlacement {
  void variant
  switch (kind) {
    case 'straight':
      return { kind, numbers: [17] }
    case 'split':
      return { kind, numbers: [17, 18] }
    case 'street':
      return { kind, numbers: [16, 17, 18] }
    case 'corner':
      return { kind, numbers: [17, 18, 20, 21] }
    case 'line':
      return { kind, numbers: [16, 17, 18, 19, 20, 21] }
    case 'column':
      return { kind, group: 1 }
    case 'dozen':
      return { kind, group: 1 }
    default:
      return { kind }
  }
}

/**
 * The pockets that defeat an even-money bet: the zeros. This is where the entire
 * house edge lives, and it is the only reason a casino has an advantage at all.
 * On the European wheel it is one pocket out of thirty-seven; on the American,
 * two out of thirty-eight.
 */
export function zeroPockets(variant: VariantId): readonly Pocket[] {
  return pocketsOf(variant).filter(isZero)
}

/**
 * Return to player as a fraction of turnover, for the encyclopedia. Identical
 * to `1 - wheelHouseEdge(variant)`.
 */
export function returnToPlayer(variant: VariantId): number {
  return 1 - wheelHouseEdge(variant)
}

/** True when a wheel carries no pocket that defeats an even-money bet. */
export function isFairWheel(variant: VariantId): boolean {
  return zeroPockets(variant).length === 0
}

/** Every bet kind, so callers can render the published table without repeating. */
export function publishedTable(variant: VariantId): {
  kind: BetKind
  payout: number
  covers: number
  edge: number
}[] {
  return BET_KINDS.map((kind) => ({
    kind,
    payout: BETS[kind].payout,
    covers: BETS[kind].covers,
    edge: houseEdge(kind, variant),
  }))
}

/** Zero is excluded from every outside bet; stated so the board can explain it. */
export function zeroLosesOutsideBets(pocket: Pocket): boolean {
  return isZero(pocket)
}