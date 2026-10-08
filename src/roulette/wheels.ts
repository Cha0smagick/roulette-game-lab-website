/**
 * Wheel definitions and the number-to-colour mapping that belongs to each one.
 *
 * The pocket ORDER is the real clockwise order of a physical wheel, not a
 * sorted list. It matters for two reasons: the renderer must draw the pockets
 * the way a player expects to find them, and the sequence is what the seeded
 * generator walks. American wheels place 0 and 00 opposite each other, which is
 * why the two values sit three pockets apart in the sequence rather than being
 * adjacent as they are in the French-style European layout.
 */

/**
 * Pocket values as the number printed inside the pocket. The double zero is
 * written "00" on the felt but is numerically the same value as "0"; the two
 * are distinguished by their position in `pockets`, not by their value. That is
 * what makes the American edge fall out correctly on its own: iterating the
 * pocket list encounters 0 twice, so an even-money bet loses on two of
 * thirty-eight pockets rather than one of thirty-seven.
 */
export type Pocket = number

export type VariantId = 'noZero' | 'european' | 'american'

export interface Wheel {
  readonly id: VariantId
  /** Clockwise pocket order as printed on the wheel. */
  readonly pockets: readonly Pocket[]
}

/**
 * European / French / single-zero wheel. The order below is the standard
 * clockwise sequence printed on every single-zero table.
 */
export const EUROPEAN: Wheel = {
  id: 'european',
  pockets: [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
    16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ],
}

/**
 * American / double-zero wheel. The two zeros are printed 18 pockets apart on
 * either side, giving the wheel its two mirrored halves.
 */
export const AMERICAN: Wheel = {
  id: 'american',
  pockets: [
    0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 0, 27,
    10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
  ],
}

/**
 * The no-zero wheel. This one does not exist in any casino; it is the
 * mathematical baseline the other two are measured against. With no pocket
 * that loses an even-money bet, the house edge is exactly zero, and every
 * strategy should therefore show an expected value indistinguishable from
 * zero. A result that disagrees means the strategy or the settlement is wrong.
 */
export const NO_ZERO: Wheel = {
  id: 'noZero',
  pockets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
}

export const WHEELS: Record<VariantId, Wheel> = {
  noZero: NO_ZERO,
  european: EUROPEAN,
  american: AMERICAN,
}

export const VARIANT_IDS: readonly VariantId[] = ['noZero', 'european', 'american']

export function getWheel(id: VariantId): Wheel {
  return WHEELS[id]
}

/**
 * The red pockets, identical on the single-zero and double-zero wheels. This is
 * not a matter of taste — it is the printed felt, and getting it wrong silently
 * changes the settlement of every red bet. Exactly 18 of the 36 numbers are red,
 * which is what makes the even-money bet a fair bet on a wheel with no zero.
 */
const RED: ReadonlySet<Pocket> = new Set<Pocket>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export type PocketColour = 'red' | 'black' | 'green'

/**
 * Colour of a pocket. The red set is identical on the single-zero and
 * double-zero wheels — the American wheel differs in pocket ORDER and in
 * carrying a second zero, not in which numbers are red. Because of that there
 * is deliberately no variant parameter here: accepting one would invite a
 * future edit that invents a difference that does not exist on real tables.
 */
export function colourOf(pocket: Pocket): PocketColour {
  if (pocket === 0) return 'green'
  return RED.has(pocket) ? 'red' : 'black'
}

/** True when the pocket is a zero, the only value that defeats an outside bet. */
export function isZeroLike(pocket: Pocket): boolean {
  return pocket === 0
}

/**
 * Build a fair uniform index for a wheel using an existing RNG.
 * Returns the index into `wheel.pockets`, so callers stay uniform across
 * variants with different pocket counts without repeating this arithmetic.
 */
export function pickPocket(
  wheel: Wheel,
  randomInt: (exclusiveMax: number) => number,
): Pocket {
  return wheel.pockets[randomInt(wheel.pockets.length)] as Pocket
}