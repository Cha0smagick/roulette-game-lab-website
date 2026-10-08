import type { AdProvider, AdResult } from './provider';
import { ENERGY_PER_BREAK } from './provider';

/**
 * Break cadence.
 *
 * This module owns the only rule that turns an ad break into energy, and it is
 * deliberately the only place that can do so. If the grant lived inside an ad
 * callback, then any callback the network happens to fire on a click would be
 * one refactor away from paying out for that click.
 *
 * The rule: a break grants ENERGY_PER_BREAK energy once the break is over.
 * Not one frame earlier, not conditional on anything the ad reported.
 */

export interface CadenceConfig {
  /** Spins between breaks. */
  readonly spinsPerBreak: number;
  /** Energy granted per completed break. */
  readonly energyPerBreak: number;
}

export const DEFAULT_CADENCE: CadenceConfig = {
  spinsPerBreak: 5,
  energyPerBreak: ENERGY_PER_BREAK,
};

/**
 * Spins remaining until the next break is due.
 *
 * Returned to the HUD on every state change and always rendered. A break that
 * arrives unannounced reads as the game seizing the session; players who feel
 * ambushed leave, and the revenue goes with them.
 */
export function spinsUntilBreak(spinIndex: number, spinsPerBreak: number): number {
  if (spinsPerBreak <= 0) {
    return 0;
  }
  const used = spinIndex % spinsPerBreak;
  return used === 0 ? spinsPerBreak : spinsPerBreak - used;
}

export function isBreakDue(spinIndex: number, spinsPerBreak: number): boolean {
  return spinsPerBreak > 0 && spinIndex % spinsPerBreak === 0;
}

/**
 * Decides how much energy a finished break is worth.
 *
 * Note what is absent: no branch on `reason === 'completed'` versus
 * `'unavailable'`, and nothing derived from user interaction. Fill rate is not
 * 100% and ad blockers are common, so tying the grant to whether the ad
 * rendered would mean a player with an ad blocker simply cannot play. The break
 * happened; the fuel is owed.
 *
 * @returns energy units to grant. Always 0 when the break was not shown at all,
 *          which only happens if the caller invoked this without a break.
 */
export function energyForBreak(
  result: AdResult | null,
  config: CadenceConfig = DEFAULT_CADENCE,
): number {
  if (result === null) {
    return 0;
  }
  // A slot that errored out mid-break still consumed the player's time.
  const waited = result.viewedMs > 0 || result.reason === 'completed';
  return waited ? config.energyPerBreak : 0;
}

/**
 * Runs one break: shows the ad, then reports the energy owed.
 *
 * The caller applies the grant. Keeping application out of here means the
 * decision and the state mutation are separately testable.
 */
export async function runBreak(provider: AdProvider): Promise<{
  result: AdResult;
  energy: number;
}> {
  let result: AdResult;
  try {
    result = await provider.show('overlay');
  } catch (error) {
    // A provider that rejects must not break the game loop. Swallowed with a
    // comment on purpose: there is nothing to recover to, and the player sees
    // the same result either way.
    void error;
    result = { reason: 'error', viewedMs: 0, rendered: false };
  }
  return { result, energy: energyForBreak(result) };
}