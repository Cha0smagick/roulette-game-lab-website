/**
 * Hypothesis tests for the only question a pattern tracker can answer honestly:
 * is this wheel behaving like a fair one?
 *
 * Nothing here predicts anything. A wheel is a physical random process; these
 * functions measure how far a sample sits from what a fair wheel of the SAME
 * layout would have produced, and they say so with a p-value rather than with a
 * verdict dressed up as a signal.
 *
 * Why the arithmetic is written out instead of imported. A statistics library is
 * roughly thirty kilobytes of other people's opinions about edge cases this site
 * does not have, and the two functions actually needed are a series and a
 * continued fraction. They are also the part a reader is most entitled to check:
 * `chiSquarePValue` is asserted in the test suite against published critical
 * values, so this implementation is compared to an external authority rather
 * than to itself.
 *
 * The reliability flag is the honest part. The chi-square distribution is an
 * approximation to the exact distribution, and the approximation degrades as the
 * expected count per outcome falls. Five is the conventional floor. Below it the
 * p-value is still computable and still reported, because a number with a stated
 * caveat beats no number at all, but `verdict` refuses to call it and says how
 * many more spins would be needed. On a wheel with a zero that threshold is a
 * long way off at the sample sizes a human collects, and saying so plainly is
 * worth more than a verdict nobody should trust.
 */

import { colourOf, type Pocket, type Wheel } from '../roulette/wheels.js'

/**
 * The smallest expected count per outcome the chi-square approximation is
 * usually trusted at. Below it the p-value drifts, so it is published as a
 * number with this caveat attached rather than withheld entirely.
 */
export const MIN_EXPECTED_PER_BIN = 5

/** At or above this p-value a fair wheel is an ordinary explanation. */
export const WEAK_P_VALUE = 0.1

/** Below this p-value the outcome is unlikely enough to be worth mentioning. */
export const STRONG_P_VALUE = 0.01

const EPSILON = 1e-14
const MAX_ITERATIONS = 500
/** Stands in for zero where a continued-fraction denominator would divide by it. */
const TINY = 1e-300
/** The Lanczos approximation below is parameterised for g = 7. */
const LANCZOS_G = 7

/**
 * The nine coefficients of the g = 7 Lanczos approximation. A tuple rather than
 * an array so index 0 reads as a known number instead of a number or undefined.
 */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
] as const

/** log of the gamma function. Only called with positive arguments. */
function logGamma(z: number): number {
  if (z <= 0 || Number.isNaN(z)) {
    throw new RangeError(`logGamma needs a positive argument, received ${String(z)}`)
  }
  if (z < 0.5) {
    // Reflection, for completeness. Every caller passes df / 2 with df >= 1, so
    // this branch is unreachable from this module; leaving it out would make the
    // helper quietly wrong for anyone who reached for it later.
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  const x = z - 1
  let sum: number = LANCZOS[0]
  for (const [index, coefficient] of LANCZOS.entries()) {
    if (index === 0) continue
    sum += coefficient / (x + index)
  }
  const t = x + LANCZOS_G + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum)
}

/**
 * The regularised lower incomplete gamma P(a, x), by its defining series. Used
 * only where P is the smaller half, so the subtraction in `regularisedGammaQ`
 * loses no precision.
 */
function regularisedGammaP(a: number, x: number): number {
  let term = 1 / a
  let sum = term
  for (let n = 1; n <= MAX_ITERATIONS; n += 1) {
    term *= x / (a + n)
    sum += term
    if (Math.abs(term) < Math.abs(sum) * EPSILON) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
}

/**
 * The same quantity by continued fraction, evaluated directly as Q rather than
 * as 1 - P. This is the whole reason the function is split: for a large
 * statistic P is one to within rounding, so subtracting it would return zero
 * exactly where the answer should be a very small number.
 */
function regularisedGammaQContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a
  let c = 1 / TINY
  let d = 1 / b
  let h = d
  for (let i = 1; i <= MAX_ITERATIONS; i += 1) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < TINY) d = TINY
    c = b + an / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < EPSILON) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

/** The upper regularised incomplete gamma Q(a, x) = 1 - P(a, x). */
function regularisedGammaQ(a: number, x: number): number {
  if (a <= 0 || Number.isNaN(a)) {
    throw new RangeError(`the gamma shape must be positive, received ${String(a)}`)
  }
  if (x < 0 || Number.isNaN(x)) {
    throw new RangeError(`the gamma argument must not be negative, received ${String(x)}`)
  }
  if (x === 0) return 1
  return x < a + 1 ? 1 - regularisedGammaP(a, x) : regularisedGammaQContinuedFraction(a, x)
}

/**
 * The share of the time a chi-square random variable of `df` degrees of freedom
 * reaches `chi2` or more. This is the p-value the tests above report, and the
 * one function in this repository whose value comes from outside it: the test
 * suite pins it against published critical values rather than against itself.
 */
export function chiSquarePValue(chi2: number, df: number): number {
  if (!Number.isFinite(chi2) || chi2 < 0) {
    throw new RangeError(`a chi-square statistic cannot be negative, received ${String(chi2)}`)
  }
  if (!Number.isFinite(df) || df <= 0) {
    throw new RangeError(`degrees of freedom must be positive, received ${String(df)}`)
  }
  if (chi2 === 0) return 1
  return regularisedGammaQ(df / 2, chi2 / 2)
}

/** One outcome a spin can be sorted into, and the predicate that recognises it. */
export interface BinSpec {
  readonly id: string
  readonly classify: (pocket: Pocket) => boolean
}

/** What one outcome actually did, next to what a fair wheel would have done. */
export interface BinObservation {
  readonly id: string
  readonly count: number
  /** Share of the comparable pockets this outcome accounts for. */
  readonly probability: number
  /** `count` scaled to the probability, i.e. what fairness would have produced. */
  readonly expected: number
}

/**
 * A goodness-of-fit result, including everything needed to judge how far to
 * trust it. `shortfall` is how many more spins the smallest outcome would need
 * before `reliable` becomes true.
 */
export interface ChiSquareTest {
  readonly chi2: number
  readonly df: number
  readonly pValue: number
  /** Spins that fell into one of the compared outcomes, which may be fewer than the spins played. */
  readonly total: number
  readonly outcomes: readonly BinObservation[]
  readonly minExpected: number
  readonly reliable: boolean
  readonly shortfall: number
}

/** What a reader is told, and never more than the numbers support. */
export interface Verdict {
  readonly level: 'uniform' | 'weak' | 'strong' | 'refused'
  /** Spins still needed. Zero for every level except `refused`. */
  readonly shortfall: number
}

/**
 * Compares recorded spins against what a fair wheel of this exact layout would
 * have produced, over the given outcomes.
 *
 * A pocket matching no outcome is excluded and the remaining probabilities are
 * renormalised over what is left. So this asks whether the spins that CAN be
 * classified are split evenly, never how often the excluded pockets came up.
 * That is why every outcome set which drops the zero says so in its name.
 */
export function chiSquareAgainst(
  entries: readonly Pocket[],
  wheel: Wheel,
  bins: readonly BinSpec[],
): ChiSquareTest {
  if (entries.length === 0) {
    throw new RangeError('a chi-square test needs at least one spin')
  }
  if (bins.length < 2) {
    throw new RangeError('a chi-square test needs at least two outcomes to compare')
  }
  const comparable = wheel.pockets.filter((pocket) => bins.some((bin) => bin.classify(pocket)))
  if (comparable.length === 0) {
    throw new RangeError('no pocket on this wheel falls into any of the compared outcomes')
  }
  for (const bin of bins) {
    if (!comparable.some((pocket) => bin.classify(pocket))) {
      throw new RangeError(`outcome "${bin.id}" matches no pocket, so its expected count is zero`)
    }
  }

  const total = entries.filter((pocket) => bins.some((bin) => bin.classify(pocket))).length
  if (total === 0) {
    throw new RangeError('not one of the recorded spins falls into the compared outcomes')
  }

  const outcomes: BinObservation[] = bins.map((bin) => {
    const pockets = comparable.filter((pocket) => bin.classify(pocket)).length
    const probability = pockets / comparable.length
    const count = entries.filter((pocket) => bin.classify(pocket)).length
    return { id: bin.id, count, probability, expected: total * probability }
  })

  let chi2 = 0
  let minExpected = Number.POSITIVE_INFINITY
  let smallestProbability = 1
  for (const outcome of outcomes) {
    chi2 += ((outcome.count - outcome.expected) ** 2) / outcome.expected
    if (outcome.expected < minExpected) minExpected = outcome.expected
    if (outcome.probability < smallestProbability) smallestProbability = outcome.probability
  }

  const reliable = minExpected >= MIN_EXPECTED_PER_BIN
  const needed = Math.ceil(MIN_EXPECTED_PER_BIN / smallestProbability)
  return {
    chi2,
    df: bins.length - 1,
    pValue: chiSquarePValue(chi2, bins.length - 1),
    total,
    outcomes,
    minExpected,
    reliable,
    shortfall: reliable ? 0 : Math.max(0, needed - total),
  }
}

/**
 * Reads the p-value and the reliability together, and is allowed to decline.
 * A p-value below `STRONG_P_VALUE` still produces a refusal when the counts are
 * too thin to support one, because a confident answer from a thin sample is the
 * failure mode this whole site exists to avoid.
 */
export function verdict(test: ChiSquareTest): Verdict {
  if (!test.reliable) return { level: 'refused', shortfall: test.shortfall }
  if (test.pValue < STRONG_P_VALUE) return { level: 'strong', shortfall: 0 }
  if (test.pValue < WEAK_P_VALUE) return { level: 'weak', shortfall: 0 }
  return { level: 'uniform', shortfall: 0 }
}

/** Every distinct number on the wheel, one outcome each. */
export function pocketBins(wheel: Wheel): BinSpec[] {
  const seen = new Set<Pocket>()
  const values: Pocket[] = []
  for (const pocket of wheel.pockets) {
    if (seen.has(pocket)) continue
    seen.add(pocket)
    values.push(pocket)
  }
  return values.map((value) => ({ id: `n${String(value)}`, classify: (pocket: Pocket) => pocket === value }))
}

/**
 * Red, black and green.
 *
 * No wheel argument, deliberately. The red numbers are the same on every wheel,
 * which is why `colourOf` in roulette/wheels.ts lost its variant parameter, and
 * a bin set that accepted a wheel it could not use would invite a future edit to
 * invent a difference that does not exist on a real table. On the American wheel
 * both zeros are green, which the predicate below gives for free.
 */
export function colourBins(): BinSpec[] {
  return (['red', 'black', 'green'] as const).map((colour) => ({
    id: colour,
    classify: (pocket: Pocket): boolean => colourOf(pocket) === colour,
  }))
}

/**
 * Odd and even, with the zero in neither. Each outcome is half the wheel's
 * ordinary numbers, so unlike every other set here this one reaches a
 * trustworthy expected count at the sample sizes a person actually collects.
 *
 * The zero test is `pocket !== 0` rather than a lookup of the wheel's zeros,
 * because the double zero shares the numeric value 0 and is told from the
 * single zero by its position: there is no second zero value to find.
 */
export function parityBins(): BinSpec[] {
  return (['odd', 'even'] as const).map((parity) => ({
    id: parity,
    classify: (pocket: Pocket): boolean => pocket !== 0 && (pocket % 2 === 0) === (parity === 'even'),
  }))
}

/** One number compared against its own expected count. */
export interface PocketZ {
  readonly pocket: Pocket
  readonly count: number
  readonly expected: number
  /** Count minus expected, in units of spins. */
  readonly deviation: number
  /** Square root of n p (1 - p), the standard deviation of a bin count. */
  readonly sd: number
  /** Deviation divided by that standard deviation. */
  readonly z: number
}

/**
 * Every distinct number, ordered by how far its count sits from what fairness
 * predicts. The ordering is the point: a reader who only sees the top of this
 * list sees the most deviant number first, which is the opposite of what a
 * sorted-by-value table would show them.
 */
export function pocketZScores(entries: readonly Pocket[], wheel: Wheel): PocketZ[] {
  if (entries.length === 0) {
    throw new RangeError('a deviation needs at least one spin')
  }
  const comparable = wheel.pockets.length
  const scores: PocketZ[] = pocketBins(wheel).map((bin) => {
    const value = Number(bin.id.slice(1))
    // Derived from the pocket list rather than from the number of distinct
    // values, so the American double zero weighs twice as heavily as a single
    // zero does without anyone having to remember that it does.
    const pockets = wheel.pockets.filter((pocket) => pocket === value).length
    const probability = pockets / comparable
    const count = entries.filter((pocket) => pocket === value).length
    const expected = entries.length * probability
    const sd = Math.sqrt(entries.length * probability * (1 - probability))
    const deviation = count - expected
    return { pocket: value, count, expected, deviation, sd, z: sd === 0 ? 0 : deviation / sd }
  })
  return scores.sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || a.pocket - b.pocket)
}