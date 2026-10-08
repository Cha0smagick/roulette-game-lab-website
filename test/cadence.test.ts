import { describe, expect, it } from 'vitest';
import { isBreakDue, spinsUntilBreak, energyForBreak, runBreak, DEFAULT_CADENCE } from '../src/ads/cadence';
import type { AdProvider, AdResult } from '../src/ads/provider';
import { createMockProvider } from '../src/ads/mock';

describe('cadence', () => {
  it('counts down to the next break and resets after it', () => {
    const per = 5;
    expect(spinsUntilBreak(0, per)).toBe(5);
    expect(spinsUntilBreak(1, per)).toBe(4);
    expect(spinsUntilBreak(4, per)).toBe(1);
    expect(spinsUntilBreak(5, per)).toBe(5);
  });

  it('never returns a negative countdown', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(spinsUntilBreak(i, 5)).toBeGreaterThan(0);
    }
  });

  it('treats a zero or negative period as always due, rather than dividing by zero', () => {
    expect(spinsUntilBreak(3, 0)).toBe(0);
    expect(spinsUntilBreak(3, -2)).toBe(0);
    expect(isBreakDue(3, 0)).toBe(false);
  });

  it('marks a break due on every cadence boundary', () => {
    expect(isBreakDue(0, 5)).toBe(true);
    expect(isBreakDue(4, 5)).toBe(false);
    expect(isBreakDue(5, 5)).toBe(true);
    expect(isBreakDue(10, 5)).toBe(true);
  });

  it('grants energy for a completed break', () => {
    const result: AdResult = { reason: 'completed', viewedMs: 5_000, rendered: true };
    expect(energyForBreak(result)).toBe(DEFAULT_CADENCE.energyPerBreak);
  });

  it('grants energy even when the ad never rendered, because the player waited', () => {
    // Ad blockers and fill failures are common. A player who loses their turn
    // because the network had a bad minute does not come back.
    const blocked: AdResult = { reason: 'completed', viewedMs: 5_000, rendered: false };
    expect(energyForBreak(blocked)).toBe(DEFAULT_CADENCE.energyPerBreak);

    const failed: AdResult = { reason: 'unavailable', viewedMs: 3_000, rendered: false };
    expect(energyForBreak(failed)).toBe(DEFAULT_CADENCE.energyPerBreak);
  });

  it('grants nothing when no break was shown at all', () => {
    expect(energyForBreak(null)).toBe(0);
  });

  it('grants nothing for an instant error that consumed no time', () => {
    const error: AdResult = { reason: 'error', viewedMs: 0, rendered: false };
    expect(energyForBreak(error)).toBe(0);
  });

  it('does not vary its payout by how the ad behaved', () => {
    // The grant is a constant by construction. This test exists so that adding
    // a "completed faster" bonus or a "clicked" branch breaks CI loudly.
    const rendered: AdResult = { reason: 'completed', viewedMs: 1_200, rendered: true };
    const notRendered: AdResult = { reason: 'completed', viewedMs: 9_000, rendered: false };
    expect(energyForBreak(rendered)).toBe(energyForBreak(notRendered));
  });

  it('runBreak reports the energy owed after showing the slot', async () => {
    const provider = createMockProvider({ delayMs: 5 });
    await provider.load();
    const { result, energy } = await runBreak(provider);
    expect(result.reason).toBe('completed');
    expect(energy).toBe(DEFAULT_CADENCE.energyPerBreak);
  });

  it('runBreak survives a provider that throws, instead of breaking the loop', async () => {
    const hostile: AdProvider = {
      async load() {
        /* never resolves a real network */
      },
      async show() {
        throw new Error('network exploded');
      },
      isReady: () => true,
    };
    const { result, energy } = await runBreak(hostile);
    expect(result.reason).toBe('error');
    expect(energy).toBe(0);
  });

  it('sustains play exactly: energy per break equals spins per break', () => {
    // The loop is only self-sustaining if one break refills what the spins it
    // replaced consumed. A surplus here would let players stop watching ads.
    expect(DEFAULT_CADENCE.energyPerBreak).toBe(DEFAULT_CADENCE.spinsPerBreak);
  });

  it('keeps the default cadence between 3 and 8 spins per break', () => {
    // Below 3 the break is relentless and the session dies. Above 8 players run
    // dry mid-run and leave before the next break.
    expect(DEFAULT_CADENCE.spinsPerBreak).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_CADENCE.spinsPerBreak).toBeLessThanOrEqual(8);
  });
});

describe('mock provider', () => {
  it('refuses to show before load', async () => {
    const provider = createMockProvider({ delayMs: 1 });
    const result = await provider.show('banner');
    expect(result.reason).toBe('unavailable');
    expect(provider.isReady()).toBe(false);
  });

  it('reports itself ready after load', async () => {
    const provider = createMockProvider({ delayMs: 1 });
    await provider.load();
    expect(provider.isReady()).toBe(true);
  });

  it('simulates an ad that never renders, matching real blocker conditions', async () => {
    const provider = createMockProvider({ delayMs: 1 });
    await provider.load();
    const result = await provider.show('overlay');
    expect(result.rendered).toBe(false);
    expect(result.reason).toBe('completed');
  });
});