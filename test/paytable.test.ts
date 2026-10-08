import { describe, expect, it } from 'vitest';
import {
  expectedReturn,
  SYMBOLS,
  THREE_OF_A_KIND,
  threeOfAKindProbability,
  tierFor,
  twoOfAKindProbability,
  winProbability,
} from '../src/game/paytable';
import { MAX_BET, MIN_BET, type SymbolId } from '../src/game/types';

describe('paytable', () => {
  it('has five symbols with unique ids, labels and positive integer weights', () => {
    expect(SYMBOLS).toHaveLength(5);
    expect(new Set(SYMBOLS.map((s) => s.id)).size).toBe(5);
    expect(new Set(SYMBOLS.map((s) => s.label)).size).toBe(5);
    for (const s of SYMBOLS) {
      expect(Number.isInteger(s.weight)).toBe(true);
      expect(s.weight).toBeGreaterThan(0);
    }
  });

  it('pays strictly more for rarer symbols', () => {
    const ordered = [...SYMBOLS].sort((a, b) => b.weight - a.weight);
    const payouts = ordered.map((s) => THREE_OF_A_KIND[s.id]);
    for (let i = 1; i < payouts.length; i += 1) {
      const prev = payouts[i - 1] ?? 0;
      const cur = payouts[i] ?? 0;
      expect(cur).toBeGreaterThan(prev);
    }
  });

  it('computes probabilities that sum with the weights', () => {
    for (const s of SYMBOLS) {
      const totalWeight = SYMBOLS.reduce((sum, x) => sum + x.weight, 0);
      const expected = (s.weight / totalWeight) ** 3;
      expect(threeOfAKindProbability(s.id)).toBeCloseTo(expected, 12);
    }
  });

  it('keeps total win probability near 42%, so it reads as responsive', () => {
    const p = winProbability();
    expect(p).toBeGreaterThan(0.38);
    expect(p).toBeLessThan(0.46);
  });

  it('counts two-of-a-kind as the majority of wins', () => {
    // If triples carried the win rate, the two-of-a-kind table would be dead
    // weight. This asserts the tier split is real rather than decorative.
    let triples = 0;
    let pairs = 0;
    for (const s of SYMBOLS) {
      triples += threeOfAKindProbability(s.id);
      pairs += twoOfAKindProbability(s.id);
    }
    expect(pairs).toBeGreaterThan(triples * 3);
  });

  it('two-of-a-kind probabilities sum below one, leaving room for triples', () => {
    let pairs = 0;
    for (const s of SYMBOLS) {
      pairs += twoOfAKindProbability(s.id);
    }
    expect(pairs).toBeLessThan(1);
  });

  it('holds RTP in the 78-88% band', () => {
    const rtp = expectedReturn();
    expect(rtp).toBeGreaterThan(0.78);
    expect(rtp).toBeLessThan(0.88);
  });

  it('rejects an unknown symbol id instead of returning a wrong probability', () => {
    expect(() => threeOfAKindProbability(9 as SymbolId)).toThrow(RangeError);
  });

  it('maps multipliers to tiers in descending order', () => {
    // Thresholds match THREE_OF_A_KIND, so each payout maps to its own tier.
    expect(tierFor(0)).toBe('none');
    expect(tierFor(1)).toBe('none');
    expect(tierFor(2)).toBe('none');
    expect(tierFor(3)).toBe('small');
    expect(tierFor(6)).toBe('small');
    expect(tierFor(12)).toBe('medium');
    expect(tierFor(31)).toBe('medium');
    expect(tierFor(32)).toBe('large');
    expect(tierFor(159)).toBe('large');
    expect(tierFor(160)).toBe('jackpot');
    expect(tierFor(480)).toBe('jackpot');
  });

  it('exposes bet bounds as 1..3', () => {
    expect(MIN_BET).toBe(1);
    expect(MAX_BET).toBe(3);
  });
});