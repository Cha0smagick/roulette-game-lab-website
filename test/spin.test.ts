import { describe, expect, it } from 'vitest';
import { createRng } from '../src/util/rng';
import { resolveSpin, spinSeed } from '../src/game/spin';
import { THREE_OF_A_KIND } from '../src/game/paytable';
import { MAX_BET, MIN_BET, type Bet, type SymbolId } from '../src/game/types';

describe('resolveSpin', () => {
  it('replays identically from the same seed', () => {
    const first = Array.from({ length: 50 }, () => {
      const rng = createRng('replay-me');
      return rng;
    });
    const a = createRng('replay-me');
    const b = createRng('replay-me');
    for (let i = 0; i < 50; i += 1) {
      expect(resolveSpin(a, 1, 's')).toEqual(resolveSpin(b, 1, 's'));
    }
    expect(first).toHaveLength(50);
  });

  it('always returns three symbols from the valid range', () => {
    const rng = createRng('validity');
    for (let i = 0; i < 2_000; i += 1) {
      const { reels } = resolveSpin(rng, 1, 's');
      expect(reels).toHaveLength(3);
      for (const s of reels) {
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(4);
      }
    }
  });

  it('pays zero only when no adjacent pair matches', () => {
    // Premise corrected: under the two-pay-path paytable, "not a triple" does not
    // mean "no win". Only a layout with no matching adjacent pair pays nothing.
    const rng = createRng('no-win');
    let checked = 0;
    for (let i = 0; i < 20_000 && checked < 50; i += 1) {
      const outcome = resolveSpin(rng, 2, 's');
      const [r1, r2, r3] = outcome.reels;
      const isTriple = r1 === r2 && r2 === r3;
      if (!isTriple && r1 !== r2 && r2 !== r3) {
        expect(outcome.payoutMultiplier).toBe(0);
        expect(outcome.tier).toBe('none');
        checked += 1;
      }
    }
    expect(checked).toBe(50);
  });

  it('pays base x bet on a three of a kind', () => {
    const rng = createRng('payout');
    let checked = 0;
    for (let i = 0; i < 20_000 && checked < 40; i += 1) {
      const bet: Bet = 3;
      const outcome = resolveSpin(rng, bet, 's');
      const [r1, r2, r3] = outcome.reels;
      if (r1 === r2 && r2 === r3) {
        expect(outcome.payoutMultiplier).toBe(THREE_OF_A_KIND[r1] * bet);
        expect(outcome.tier).not.toBe('none');
        checked += 1;
      }
    }
    expect(checked).toBe(40);
  });

  it('scales payout linearly with the bet', () => {
    const base = createRng('linear');
    const triple = createRng('linear');
    for (let i = 0; i < 5_000; i += 1) {
      const one = resolveSpin(base, MIN_BET, 's');
      const three = resolveSpin(triple, MAX_BET, 's');
      // Same reel layout because the roll sequence is identical.
      expect(three.reels).toEqual(one.reels);
      if (one.payoutMultiplier > 0) {
        expect(three.payoutMultiplier).toBe(one.payoutMultiplier * MAX_BET);
      }
    }
  });

  it('records the seed it used', () => {
    const rng = createRng('seeded');
    const seed = spinSeed('session-x', 7);
    expect(seed).toBe('session-x:7');
    expect(resolveSpin(rng, 1, seed).seedUsed).toBe(seed);
  });

  it('flags near-misses only on losing spins with adjacent symbols', () => {
    const rng = createRng('near-miss');
    let nearMisses = 0;
    for (let i = 0; i < 20_000; i += 1) {
      const outcome = resolveSpin(rng, 1, 's');
      const [r1, r2, r3] = outcome.reels;
      if (outcome.nearMiss) {
        // Outer pair matches, middle is adjacent, nothing paid.
        expect(outcome.payoutMultiplier).toBe(0);
        expect(r1).toBe(r3);
        expect(r1).not.toBe(r2);
        expect(Math.abs(r2 - r1)).toBe(1);
        nearMisses += 1;
      }
    }
    // Measured rate is ~8.7% (outer pair matches, middle is adjacent). That fires
    // roughly every 11 spins: common enough to give the reels rhythm, far below
    // the 42% of spins that actually pay. Asserted as a band so a future paytable
    // edit cannot quietly turn near-misses into the dominant outcome.
    expect(nearMisses).toBeGreaterThan(500);
    expect(nearMisses).toBeLessThan(2_500);
  });

  it('never produces a near-miss on a winning spin', () => {
    const rng = createRng('no-near-miss-on-win');
    for (let i = 0; i < 20_000; i += 1) {
      const outcome = resolveSpin(rng, 2, 's');
      if (outcome.payoutMultiplier > 0) {
        expect(outcome.nearMiss).toBe(false);
      }
    }
  });

  it('keeps observed win frequency near the published table', () => {
    const rng = createRng('frequency');
    const spins = 100_000;
    let wins = 0;
    for (let i = 0; i < spins; i += 1) {
      if (resolveSpin(rng, 1, 's').payoutMultiplier > 0) {
        wins += 1;
      }
    }
    const rate = wins / spins;
    // Matches winProbability() in paytable.ts, within sampling noise.
    expect(rate).toBeGreaterThan(0.36);
    expect(rate).toBeLessThan(0.46);
  });

  it('pays two-of-a-kind without promoting it to a named tier', () => {
    // A pair pays credits but must not announce itself as "small win". Labelling
    // roughly every third spin a win would make the real tiers feel cheap.
    const rng = createRng('pair-tier');
    let pairs = 0;
    for (let i = 0; i < 20_000; i += 1) {
      const outcome = resolveSpin(rng, 1, 's');
      const [r1, r2, r3] = outcome.reels;
      const isTriple = r1 === r2 && r2 === r3;
      const isPair = !isTriple && (r1 === r2 || r2 === r3);
      if (isPair) {
        expect(outcome.payoutMultiplier).toBeGreaterThan(0);
        // A pair pays credits but announces no tier. Labelling roughly every
        // third spin "small win" would cheapen the tiers that should feel rare.
        expect(outcome.tier).toBe('none');
        pairs += 1;
      }
      if (isTriple) {
        expect(outcome.tier).not.toBe('none');
        expect(outcome.payoutMultiplier).toBeGreaterThanOrEqual(3);
      }
    }
    expect(pairs).toBeGreaterThan(1000);
  });

  it('observed RTP over many spins lands near the published figure', () => {
    // The strongest check in the suite: it would catch a payout table that the
    // unit tests each approve individually but that is jointly unbalanced.
    const rng = createRng('rtp');
    const spins = 200_000;
    const bet = 1;
    let returned = 0;
    for (let i = 0; i < spins; i += 1) {
      returned += resolveSpin(rng, bet, 's').payoutMultiplier;
    }
    const rtp = returned / (spins * bet);
    expect(rtp).toBeGreaterThan(0.75);
    expect(rtp).toBeLessThan(0.9);
  });

  it('keeps jackpot rate rare enough to feel like an event', () => {
    const rng = createRng('jackpot-rate');
    const spins = 200_000;
    let jackpots = 0;
    for (let i = 0; i < spins; i += 1) {
      if (resolveSpin(rng, 1, 's').tier === 'jackpot') {
        jackpots += 1;
      }
    }
    // REEL weight is 1 of 19, so p(three of a kind) = (1/19)^3 ~ 1/6859 per spin.
    const rate = jackpots / spins;
    expect(rate).toBeGreaterThan(0.00005);
    expect(rate).toBeLessThan(0.0005);
  });

  it('handles every symbol id without an undefined lookup', () => {
    const rng = createRng('symbols');
    const seen = new Set<SymbolId>();
    for (let i = 0; i < 5_000; i += 1) {
      const { reels } = resolveSpin(rng, 1, 's');
      for (const s of reels) {
        seen.add(s);
      }
    }
    expect(seen.size).toBe(5);
  });
});