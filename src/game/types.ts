/**
 * Domain types for REELAZO.
 *
 * No ad-network types appear here. `src/game/` must never import from
 * `src/ads/`; ads are fuel, not a mechanic. See PLAN.md section 1.
 */

/** Symbol index into PAYTABLE.reelStops. Index 0 is the lowest payout. */
export type SymbolId = 0 | 1 | 2 | 3 | 4;

/** Energy units per bet size. Energy is spent, never bought. */
export const MIN_BET = 1;
export const MAX_BET = 3;
export type Bet = typeof MIN_BET | typeof MAX_BET | 2;

export type WinTier = 'none' | 'small' | 'medium' | 'large' | 'jackpot';

/** One spin outcome. Pure data: no timers, no DOM, no ad references. */
export interface SpinOutcome {
  /** One symbol per reel, left to right. */
  reels: readonly [SymbolId, SymbolId, SymbolId];
  /** Multiplier applied to the bet. 0 means no win. */
  payoutMultiplier: number;
  tier: WinTier;
  /** True when reels 1 and 2 match but reel 3 lands one symbol short. */
  nearMiss: boolean;
  /** Seed fragment for this spin, shown in the session log. */
  seedUsed: string;
}

/** Progressive jackpot: bounded, grows per spin, resets on a jackpot hit. */
export interface JackpotState {
  amount: number;
  /** Upper bound. Past this the jackpot stops growing instead of inflating. */
  cap: number;
}