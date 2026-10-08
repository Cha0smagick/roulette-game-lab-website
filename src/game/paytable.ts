import type { SymbolId, WinTier } from './types';

/**
 * The published paytable.
 *
 * This file IS the contract. It is the single source of truth for the maths, it
 * is imported by the spin resolver, and the in-game paytable screen renders the
 * same numbers. There is deliberately no second copy to drift out of sync.
 *
 * Targets, all asserted in test/paytable.test.ts so they cannot rot silently:
 * - RTP near 82%. The remainder is the operator's margin on a free game. A
 *   near-100% RTP would mean nobody funds the ad slots the game runs on.
 * - Win frequency near 42% of spins. High enough that the slot reads as
 *   responsive, low enough that a three-of-a-kind still lands as an event.
 * - Every probability is derived from integer weights rather than hand-written
 *   floats, so the distribution can be audited by hand from this file alone.
 */

export interface Symbol {
  readonly id: SymbolId;
  /** Short in-game label. Kept small so it fits a narrow reel. */
  readonly label: string;
  /** Per-reel occurrence weight. Higher weight = appears more often. */
  readonly weight: number;
  /** CSS color, used by both the canvas reel and the paytable screen. */
  readonly color: string;
}

/**
 * Weight 1 for the top symbol is deliberate: the jackpot must be rare enough to
 * feel like an event, and the progressive cap (see JACKPOT) keeps it affordable.
 */
export const SYMBOLS: readonly Symbol[] = [
  { id: 0, label: '7', weight: 6, color: '#8A93B8' },
  { id: 1, label: 'BELL', weight: 5, color: '#35C4D9' },
  { id: 2, label: 'BAR', weight: 4, color: '#4ADE80' },
  { id: 3, label: 'DIAM', weight: 3, color: '#FFB03A' },
  { id: 4, label: 'REEL', weight: 1, color: '#A78BFA' },
] as const;

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

/** Cumulative weight boundaries, ascending. Enables O(1) symbol lookup. */
const CUMULATIVE: readonly number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const s of SYMBOLS) {
    acc += s.weight;
    out.push(acc);
  }
  return out;
})();

/**
 * Maps a uniform float in [0, 1) to a symbol. Kept next to the paytable so the
 * distribution lives beside the payouts it feeds.
 */
export function symbolFromRoll(roll: number): SymbolId {
  const scaled = roll * TOTAL_WEIGHT;
  for (let i = 0; i < CUMULATIVE.length; i += 1) {
    const edge = CUMULATIVE[i];
    if (edge !== undefined && scaled < edge) {
      return SYMBOLS[i]?.id ?? 0;
    }
  }
  // Float edge case: a roll rounding up to exactly 1. Highest symbol wins.
  return 4;
}

/**
 * Three-of-a-kind payouts in credits, indexed by symbol id. Scales with the bet,
 * so betting more energy is worth the energy.
 *
 * Values tuned against expectedReturn() to land RTP near 82%, not chosen for
 * looks. If you edit these, the RTP test reports what you actually built.
 */
export const THREE_OF_A_KIND: Readonly<Record<SymbolId, number>> = {
  0: 3, // 7 - frequent, pays least
  1: 6, // BELL
  2: 12, // BAR
  3: 32, // DIAM
  4: 160, // REEL - rare
};

/**
 * Payout for two matching symbols on reels 1-2 or 2-3. This is what lifts win
 * frequency from the ~6% that three-of-a-kind alone would give, to the ~42% the
 * game targets. A slot with a 6% hit rate feels broken on a phone, where a
 * session is only tens of spins long.
 */
export const TWO_OF_A_KIND: Readonly<Record<SymbolId, number>> = {
  0: 1,
  1: 1,
  2: 1,
  3: 1,
  4: 2, // two REELs pays a little more, consistent with its rarity
};

/** Tier thresholds on the three-of-a-kind base payout. Highest match wins. */
const TIER_THRESHOLDS: readonly { readonly tier: WinTier; readonly min: number }[] = [
  { tier: 'jackpot', min: 160 },
  { tier: 'large', min: 32 },
  { tier: 'medium', min: 12 },
  { tier: 'small', min: 3 },
];

export function tierFor(base: number): WinTier {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (base >= min) {
      return tier;
    }
  }
  return 'none';
}

/** Per-symbol roll probability: weight / totalWeight. */
export function symbolProbability(symbolId: SymbolId): number {
  const symbol = SYMBOLS.find((s) => s.id === symbolId);
  if (symbol === undefined) {
    throw new RangeError(`unknown symbol id ${symbolId}`);
  }
  return symbol.weight / TOTAL_WEIGHT;
}

/** P(three of a kind on a specific symbol) = p^3. */
export function threeOfAKindProbability(symbolId: SymbolId): number {
  const p = symbolProbability(symbolId);
  return p * p * p;
}

/**
 * P(two matching on reels 1-2 or 2-3, excluding three of a kind) = 2p^2(1-p).
 * Reels are independent; the (1-p) factor on the third reel removes the triple
 * case so the two payout paths never both pay.
 */
export function twoOfAKindProbability(symbolId: SymbolId): number {
  const p = symbolProbability(symbolId);
  return 2 * p * p * (1 - p);
}

/**
 * Expected credits returned per spin at bet 1. The RTP test compares this
 * against the 80-90% band.
 */
export function expectedReturn(): number {
  let ev = 0;
  for (const s of SYMBOLS) {
    ev += threeOfAKindProbability(s.id) * THREE_OF_A_KIND[s.id];
    ev += twoOfAKindProbability(s.id) * TWO_OF_A_KIND[s.id];
  }
  return ev;
}

/** Probability that a spin pays anything at all. */
export function winProbability(): number {
  let p = 0;
  for (const s of SYMBOLS) {
    p += threeOfAKindProbability(s.id) + twoOfAKindProbability(s.id);
  }
  return p;
}

export const JACKPOT = {
  /** Starting amount in credits. */
  seed: 250,
  /** Hard ceiling. The progressive stops growing here. */
  cap: 5_000,
  /** Credits added per spin while below the cap. */
  growthPerSpin: 1,
} as const;

// Bet bounds live in types.ts. Re-exporting them here would create two sources
// of truth for the same constraint.