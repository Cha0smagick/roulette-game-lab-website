import type { Rng } from '../util/rng';
import { createRng, seedFromString } from '../util/rng';
import type { Bet, SpinOutcome, SymbolId } from './types';
import { symbolFromRoll, THREE_OF_A_KIND, TWO_OF_A_KIND, tierFor } from './paytable';

/**
 * Spin resolution. Pure: no timers, no DOM, no randomness beyond the injected
 * Rng. That is what makes a disputed spin replayable from its seed.
 */

/**
 * A near-miss is reels 1 and 2 matching with reel 3 one weight-step away from a
 * win, and only on non-winning spins.
 *
 * Restriction that matters: it can never be *manufactured*. It is detected after
 * the symbols are already drawn. A game that re-rolls the third reel to fake a
 * near-miss is lying about its odds, which is both the reason this project
 * publishes its paytable and the reason a near-miss here is safe to keep.
 */
function detectNearMiss(reels: readonly [SymbolId, SymbolId, SymbolId]): boolean {
  const [r1, r2, r3] = reels;
  // Outer reels match, middle reel is one weight-step away from them.
  //
  // Note the shape: a match on reels 1-2 or 2-3 PAYS under this paytable, so it
  // cannot be a near-miss. Only the non-adjacent outer pair produces the visual
  // "one step away" moment, and it never pays. That is the whole point of
  // detecting it after the draw rather than manufacturing it.
  if (r1 !== r3) {
    return false;
  }
  return Math.abs(r2 - r1) === 1;
}

/**
 * Resolves one spin.
 *
 * @param rng   Injected generator. Advancing it is the only side effect.
 * @param bet   1..3 energy units.
 * @param seed  Label recorded on the outcome for replay/audit.
 */
export function resolveSpin(rng: Rng, bet: Bet, seed: string): SpinOutcome {
  const reels: [SymbolId, SymbolId, SymbolId] = [
    symbolFromRoll(rng.next()),
    symbolFromRoll(rng.next()),
    symbolFromRoll(rng.next()),
  ];

  const [r1, r2, r3] = reels;
  const threeOfAKind = r1 === r2 && r2 === r3;
  // Two matching on either adjacent pair, and only when it is not a triple, so
  // the two payout paths can never both pay.
  const twoOfAKind = !threeOfAKind && (r1 === r2 || r2 === r3);

  // Payout scales with the bet, so betting more energy is worth the energy.
  const base = threeOfAKind ? THREE_OF_A_KIND[r1] : twoOfAKind ? TWO_OF_A_KIND[r1 === r2 ? r1 : r2] : 0;
  const payoutMultiplier = base * bet;

  return {
    reels,
    payoutMultiplier,
    // Tiers describe the three-of-a-kind scale. A two-of-a-kind pays but is
    // deliberately not promoted to a named tier: it is a small return, not an
    // event, and labelling it "small win" on every sixth spin would cheapen
    // the tiers that should feel rare.
    tier: threeOfAKind ? tierFor(base) : 'none',
    nearMiss: payoutMultiplier === 0 && detectNearMiss(reels),
    seedUsed: seed,
  };
}

/** Builds a per-spin seed that is unique but reproducible from the session seed. */
export function spinSeed(sessionSeed: string, spinIndex: number): string {
  return `${sessionSeed}:${spinIndex}`;
}

export { createRng, seedFromString };