import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from '../src/util/rng';

describe('rng', () => {
  it('produces identical streams for identical seeds', () => {
    const a = createRng('reelazo-seed');
    const b = createRng('reelazo-seed');
    for (let i = 0; i < 200; i += 1) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different streams for different seeds', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    const firstA = Array.from({ length: 20 }, () => a.next());
    const firstB = Array.from({ length: 20 }, () => b.next());
    expect(firstA).not.toEqual(firstB);
  });

  it('stays inside [0, 1)', () => {
    const rng = createRng('range');
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform across ten buckets', () => {
    const rng = createRng('uniformity');
    const buckets = new Array<number>(10).fill(0);
    const samples = 100_000;
    for (let i = 0; i < samples; i += 1) {
      const idx = Math.floor(rng.next() * 10);
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }
    // Each bucket should hold ~10%. Allow 1 percentage point of slack, which is
    // ~3 sigma for this sample size and still tight enough to catch a real bias.
    for (const count of buckets) {
      expect(count / samples).toBeGreaterThan(0.09);
      expect(count / samples).toBeLessThan(0.11);
    }
  });

  it('int() stays inside bounds and hits both endpoints', () => {
    const rng = createRng('bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('int() rejects non-positive and non-integer bounds', () => {
    const rng = createRng('guards');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(-1)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
  });

  it('exposes serializable uint32 state that changes as it advances', () => {
    const rng = createRng('state');
    const before = rng.getState();
    rng.next();
    const after = rng.getState();
    expect(before).toHaveLength(4);
    for (const word of after) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(0x1_0000_0000);
    }
    expect(after).not.toEqual(before);
  });

  it('hashes distinct strings to distinct uint32s', () => {
    const hashes = new Set(['a', 'b', 'c', 'REELAZO', ''].map(seedFromString));
    expect(hashes.size).toBe(5);
  });
});