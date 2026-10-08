/**
 * Ad provider abstraction.
 *
 * Everything about ads lives behind this interface. `src/game/` never imports
 * from `src/ads/`, so the game can be tested with a mock and cannot accidentally
 * grow a dependency on a third-party script.
 *
 * THE ONE RULE
 * ------------
 * Nothing in this file exposes anything click-shaped. There is no onClick, no
 * `clicked` result, no callback that a click could reach.
 *
 * This is not squeamishness, it is account survival. Under every ad network's
 * terms, paying or rewarding for a click is incentivized traffic: the fraud
 * systems match an ad-click event against a subsequent change in app state and
 * the pattern is machine-detectable. The penalty is suspension plus withholding
 * of money already earned, which takes revenue to zero permanently. One
 * `if (clicked) grantEnergy()` line would do that.
 *
 * So a click is not merely unrewarded here. It is invisible to the game.
 */

export type AdSlot = 'banner' | 'overlay';

/**
 * Why an ad slot finished. These are the only outcomes the game distinguishes,
 * and none of them references user interaction with the ad itself.
 */
export type AdResultReason = 'completed' | 'unavailable' | 'error';

export interface AdResult {
  readonly reason: AdResultReason;
  /** Milliseconds the slot was actually on screen. Used for metrics only. */
  readonly viewedMs: number;
  /**
   * Whether the slot rendered at all. When false the game grants energy anyway:
   * fill rate is never 100%, and a player who loses their turn because an ad
   * server had a bad minute will not come back.
   */
  readonly rendered: boolean;
}

export interface AdProvider {
  /**
   * Loads the network's script and tags. Resolves when the provider is ready OR
   * has definitively failed; never rejects, because a failed ad load must never
   * take the game down with it.
   */
  load(): Promise<void>;

  /**
   * Shows one ad in the given slot and resolves when it is over.
   * Never rejects.
   */
  show(slot: AdSlot): Promise<AdResult>;

  /** Whether the provider has finished loading and can show ads. */
  isReady(): boolean;
}

/**
 * Energy granted per completed break.
 *
 * Sized against the cadence in cadence.ts: a player at the default cadence of one
 * break per 5 spins receives 5 energy per break, so it exactly sustains play with
 * no surplus. A surplus would let a player stop watching ads and keep playing,
 * which is the opposite of the design.
 */
export const ENERGY_PER_BREAK = 5;