import { describe, expect, it } from 'vitest';
import { EUROPEAN, AMERICAN, NO_ZERO, type VariantId } from '../src/roulette/wheels';
import {
  TAU,
  labelRotation,
  normalize,
  pocketAtPointer,
  pocketLabel,
  wheelGeometry,
  rotationLandingOn,
  sweepFor,
} from '../src/ui/wheel';

const VARIANTS: readonly VariantId[] = ['noZero', 'european', 'american'];

const wheelFor = (id: VariantId): { readonly id: VariantId; readonly pockets: readonly number[] } => {
  if (id === 'noZero') return NO_ZERO;
  if (id === 'european') return EUROPEAN;
  return AMERICAN;
};

describe('sweepFor', () => {
  it('divides a full turn by the pocket count', () => {
    expect(sweepFor(36)).toBeCloseTo(TAU / 36, 12);
    expect(sweepFor(37)).toBeCloseTo(TAU / 37, 12);
    expect(sweepFor(38)).toBeCloseTo(TAU / 38, 12);
  });

  it('sums to exactly one full turn across every pocket', () => {
    for (const count of [36, 37, 38]) {
      expect(sweepFor(count) * count).toBeCloseTo(TAU, 12);
    }
  });

  it('rejects a count that cannot index a pocket list', () => {
    expect(() => sweepFor(0)).toThrow(RangeError);
    expect(() => sweepFor(-1)).toThrow(RangeError);
    expect(() => sweepFor(1.5)).toThrow(RangeError);
    expect(() => sweepFor(Number.NaN)).toThrow(RangeError);
  });
});

describe('normalize', () => {
  it('wraps negative angles up into one turn', () => {
    expect(normalize(-TAU / 4)).toBeCloseTo((3 * TAU) / 4, 12);
    expect(normalize(-TAU)).toBeCloseTo(0, 12);
  });

  it('wraps angles larger than one turn back down', () => {
    expect(normalize(TAU)).toBeCloseTo(0, 12);
    expect(normalize(5 * TAU + 1)).toBeCloseTo(1, 12);
  });

  it('leaves angles already inside one turn alone', () => {
    expect(normalize(0)).toBe(0);
    expect(normalize(1.234)).toBeCloseTo(1.234, 12);
  });

  it('always lands inside [0, TAU) for any finite input', () => {
    for (let i = -50; i <= 50; i += 1) {
      const angle = normalize(i * 0.37);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(TAU);
    }
  });
});

describe('rotationLandingOn and pocketAtPointer are inverses', () => {
  // The pointer sits at 12 o'clock, which is canvas angle -PI/2 because canvas
  // angles start at 3 o'clock and grow clockwise with y pointing down.
  for (const variant of VARIANTS) {
    const wheel = wheelFor(variant);
    const count = wheel.pockets.length;

    it(`round-trips every pocket of the ${variant} wheel`, () => {
      for (let index = 0; index < count; index += 1) {
        const rotation = rotationLandingOn(index, count);
        expect(pocketAtPointer(rotation, count)).toBe(index);
      }
    });

    it(`puts a distinct rotation under every pocket of the ${variant} wheel`, () => {
      // If two pockets shared a landing rotation the pointer could not tell
      // them apart, and the renderer would silently land on the wrong number.
      // A Map keyed by the rounded number, not a Set of `toFixed` strings: the
      // point is that 37 distinct numeric rotations exist, and comparing
      // formatted strings would hide a rotation difference below 1e-9.
      const rotations = new Map<number, number>();
      for (let index = 0; index < count; index += 1) {
        rotations.set(index, normalize(rotationLandingOn(index, count)));
      }
      const distinct = new Set<number>();
      for (const rotation of rotations.values()) {
        distinct.add(Math.round(rotation * 1e9) / 1e9);
      }
      expect(distinct.size).toBe(count);
    });

    it(`never returns an out-of-range pocket index on the ${variant} wheel`, () => {
      // Sweep the whole turn in coarse steps plus a few deliberately awkward
      // angles, so a rounding artefact at the seam cannot escape unnoticed.
      for (let step = -400; step <= 400; step += 1) {
        const rotation = (step / 400) * TAU * 3;
        const index = pocketAtPointer(rotation, count);
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(count);
      }
    });
  }
});

describe('pocketLabel', () => {
  it('prints the single zero as 0 and every other pocket as its own number', () => {
    expect(pocketLabel(EUROPEAN, 0)).toBe('0');
    expect(pocketLabel(EUROPEAN, 1)).toBe('32');
    expect(pocketLabel(NO_ZERO, 0)).toBe('1');
    expect(pocketLabel(NO_ZERO, 35)).toBe('36');
  });

  it('prints the double zero as 00 while the single zero stays 0', () => {
    // On the American wheel the value 0 occupies two pockets. They are told
    // apart by position, not by value, so a label lookup needs no variant.
    const labels = AMERICAN.pockets.map((_, index) => pocketLabel(AMERICAN, index));
    expect(labels[0]).toBe('0');
    expect(labels.filter((label) => label === '0')).toHaveLength(1);
    expect(labels.filter((label) => label === '00')).toHaveLength(1);
  });

  it('places the double zero on the American wheel opposite the single zero', () => {
    expect(pocketLabel(AMERICAN, 19)).toBe('00');
    expect(pocketLabel(AMERICAN, 0)).toBe('0');
  });

  it('labels every pocket of every wheel with something readable', () => {
    for (const variant of VARIANTS) {
      const wheel = wheelFor(variant);
      for (let index = 0; index < wheel.pockets.length; index += 1) {
        const label = pocketLabel(wheel, index);
        expect(label).toMatch(/^\d{1,2}$/);
        expect(label).not.toBe('');
      }
    }
  });

  it('rejects an index the wheel does not have', () => {
    expect(() => pocketLabel(EUROPEAN, -1)).toThrow(RangeError);
    expect(() => pocketLabel(EUROPEAN, 37)).toThrow(RangeError);
    expect(() => pocketLabel(NO_ZERO, 36)).toThrow(RangeError);
  });
});

describe('labelRotation', () => {
  it('reads upright exactly at the pointer', () => {
    // At 12 o'clock a wheel prints its numbers the way the page does.
    expect(labelRotation(-Math.PI / 2)).toBeCloseTo(0, 12);
  });

  it('turns the digit a quarter turn when it passes 3 oclock', () => {
    expect(labelRotation(0)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('turns the digit the other way at 9 oclock', () => {
    // labelRotation is defined as -(absoluteAngle + PI/2), so 9 oclock (PI) gives
    // -3PI/2, a quarter turn clockwise. That is what a physical wheel prints:
    // the digits lie on a radius with their tops toward the hub.
    expect(labelRotation(Math.PI)).toBeCloseTo(-1.5 * Math.PI, 12);
  });

  it('is unchanged after the wheel completes a full turn', () => {
    // Not periodic to zero: a rotation of -TAU is the same orientation as 0. The
    // meaningful invariant is equality modulo a full turn.
    const upright = labelRotation(-Math.PI / 2);
    const afterOneTurn = labelRotation(-Math.PI / 2 + TAU);
    expect(Math.abs(afterOneTurn - upright + TAU)).toBeCloseTo(0, 12);
  });
});

describe('wheelGeometry refuses to describe a wheel it cannot draw', () => {
  // Regression: the live page threw IndexSizeError "The radius provided (-5.56)
  // is negative" and froze on its loading screen. A detached canvas measures
  // 0x0, the old code floored that to 1px, and a 1px wheel has an outer radius
  // of 0.5 - 0.06 - 6. The assertion below pins the exact arithmetic so the
  // clamp cannot come back unnoticed.
  it('reports a 1px wheel as unusable, which is what -5.56 was', () => {
    expect(wheelGeometry(1)).toBeNull()
    const outer = 1 / 2
    const radius = outer - 1 * 0.06 - Math.max(6, 1 * 0.045)
    expect(radius).toBeCloseTo(-5.56, 2)
  })

  it('refuses a zero, negative or non-finite size', () => {
    expect(wheelGeometry(0)).toBeNull()
    expect(wheelGeometry(-40)).toBeNull()
    expect(wheelGeometry(Number.NaN)).toBeNull()
    expect(wheelGeometry(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('finds the smallest size that still has room for pockets', () => {
    // size/2 - size*0.06 - 6 > 0  =>  size > 13.636...
    expect(wheelGeometry(13)).toBeNull()
    expect(wheelGeometry(14)).not.toBeNull()
  })

  it('describes every real phone width', () => {
    for (const size of [320, 360, 390, 430, 768, 1280]) {
      const wheel = wheelGeometry(size)
      expect(wheel).not.toBeNull()
      if (wheel === null) return
      expect(wheel.rInner).toBeGreaterThan(0)
      expect(wheel.rOuter).toBeGreaterThan(wheel.rInner)
      expect(wheel.outer).toBeCloseTo(size / 2, 6)
      // The label sits between the hub and the rim, or the digits fall off.
      expect(wheel.labelR).toBeGreaterThan(wheel.rInner)
      expect(wheel.labelR).toBeLessThan(wheel.rOuter)
    }
  })
})

describe('the geometry the renderer actually composes', () => {
  it('sweeps wedges across the full turn so no gap opens between pockets', () => {
    for (const variant of VARIANTS) {
      const count = wheelFor(variant).pockets.length;
      const sweep = sweepFor(count);
      // rotationLandingOn returns a pocket CENTRE, so consecutive centres are one
      // sweep apart, and each wedge spans half a sweep either side. The trailing
      // edge of one wedge must therefore land exactly on the leading edge of the
      // next: a mismatch here shows up on screen as a hairline of bare felt.
      for (let index = 1; index < count; index += 1) {
        const previousCentre = rotationLandingOn(index - 1, count);
        const thisCentre = rotationLandingOn(index, count);
        expect(previousCentre - thisCentre).toBeCloseTo(sweep, 9);
        expect(previousCentre - sweep / 2).toBeCloseTo(thisCentre + sweep / 2, 9);
      }
    }
  });

  it('agrees on pocket count between the wheel and the sweep it is drawn with', () => {
    expect(wheelFor('noZero').pockets.length).toBe(36);
    expect(wheelFor('european').pockets.length).toBe(37);
    expect(wheelFor('american').pockets.length).toBe(38);
  });
});