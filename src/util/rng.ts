/**
 * Deterministic RNG with serializable state.
 *
 * Why not Math.random(): a player who loses can never prove the result was fair,
 * and "seeded, reproducible, published paytable" is the entire difference between
 * a game and a scam. The seed is stored with every session so any disputed spin
 * can be replayed exactly.
 *
 * sfc32: 128-bit state, passes PractRand, fast, and its whole state is four
 * uint32 values, which makes it trivially serializable.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, bound). bound must be a positive integer. */
  int(bound: number): number;
  /** Current state as four uint32 values. Safe to persist. */
  getState(): readonly [number, number, number, number];
}

const UINT32 = 0x1_0000_0000;

/** Hashes an arbitrary string into a well-distributed uint32. */
export function seedFromString(input: string): number {
  let h = 2_166_136_261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h >>> 0;
}

/** Builds an sfc32 generator from a string seed, stretched across four words. */
export function createRng(seed: string): Rng {
  let a = seedFromString(seed);
  let b = seedFromString(`b:${seed}`);
  let c = seedFromString(`c:${seed}`);
  let d = seedFromString(`d:${seed}`);

  const step = (): void => {
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    // |0 yields a signed int32; >>> 0 normalizes back to uint32.
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
  };

  const next = (): number => {
    step();
    return ((a + b + c + d) >>> 0) / UINT32;
  };

  // sfc32 needs a short warm-up before the stream is statistically usable.
  for (let i = 0; i < 12; i += 1) {
    next();
  }

  return {
    next,
    int(bound: number): number {
      if (!Number.isInteger(bound) || bound <= 0) {
        throw new RangeError(`rng.int bound must be a positive integer, got ${bound}`);
      }
      // Modulo bias at these bounds is below 1e-7, immaterial against a
      // published paytable. Stated so it reads as an assumption, not an accident.
      return Math.floor(next() * bound);
    },
    getState: () => [a, b, c, d],
  };
}