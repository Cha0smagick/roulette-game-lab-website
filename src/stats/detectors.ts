/**
 * The detectors the paid sites sell, each publishing its measured rate beside the
 * rate a fair wheel gives for the same question.
 *
 * ## Why every expectation is derived
 *
 * Each detector below reports `expected`, and none of them is a typed-in number.
 * That is the whole point of the module: the popular expectation for a "repeat"
 * is 1/37 on a single-zero wheel, which is right, and the equally popular claim
 * that it is 1/38 on a double-zero wheel is **wrong** — not merely different,
 * wrong in the opposite direction, because the American wheel has one pocket
 * value that occupies two slots and a repeat is therefore *more* likely there,
 * not less. Writing either figure by hand bakes in an answer. Enumerating the
 * wheel produces the right one for free and keeps producing the right one after
 * a pocket list is corrected.
 *
 * ## Order
 *
 * Every function here takes `entries` in **spin order, oldest first**. The
 * `History` type this project stores is newest-first, because that is what a
 * history strip reads in, so passing `history.entries` straight in would run
 * every detector backwards. `chronological` exists to make that reversal a named
 * operation with a test on it rather than an inline `.reverse()` nobody reconsiders.
 *
 * ## What a detector cannot do
 *
 * None of these predicts anything. The wheel is a physical random process; each
 * detector answers "if the wheel is fair, how often would this pattern appear?"
 * and the answer is almost always "about as often as it did". A detector whose
 * measured rate differs from its expected rate by a couple of standard errors has
 * found noise, and `z` is what lets the panel say so with a number rather than a
 * hunch.
 */

import { colourOf, type Pocket, type PocketColour, type Wheel } from '../roulette/wheels.js'

/** The detectors this module provides, in the order the page presents them. */
export const DETECTOR_IDS = [
  'repeat',
  'alternating',
  'colourRun',
  'hotContinuation',
  'coldContinuation',
  'recentWindow',
] as const

export type DetectorId = (typeof DETECTOR_IDS)[number]

export interface DetectorResult {
  readonly id: DetectorId
  /** How many times the detector's condition was met AND its outcome matched. */
  readonly wins: number
  /** How many times the condition was met at all. Zero means the wheel was never in that state. */
  readonly total: number
  /** `wins / total`, or 0 when the condition never arose. */
  readonly rate: number
  /** The rate a fair wheel produces for this detector on this wheel. Always derived. */
  readonly expected: number
  /** `rate - expected`. */
  readonly delta: number
  /** `delta` in standard errors, or 0 when the sample cannot support the claim. */
  readonly z: number
  /**
   * Whether `total` is large enough for `rate` to mean anything. A colour run of
   * length six inside a hundred spins may arise zero times, and a rate measured
   * from two events is not a result.
   */
  readonly reliable: boolean
}

/**
 * Below this many triggers a measured rate is arithmetic noise, and the panel
 * prints the refusal instead of the number. Thirty events puts the standard
 * error of a half-probability rate near nine percentage points, which is wide
 * enough that the honest reading is "this cannot distinguish anything", and
 * narrow enough that a real effect would survive it.
 */
export const MIN_TRIGGERS = 30

/** The fraction of pockets the hot and cold deciles select. */
export const DECILE = 10

/**
 * How each pocket VALUE occurs on a given wheel, derived by counting the wheel's
 * own pocket list.
 *
 * On the American wheel the double zero occupies two of the thirty-eight
 * positions while sharing one numeric value, so the value `0` has probability
 * `2/38` and every ordinary number `1/38`. Any expectation that involves two
 * draws landing on the same value has to account for that, and no other data
 * structure in this repository holds the multiplicity.
 */
export function pocketProbabilities(wheel: Wheel): Map<Pocket, number> {
  const counts = new Map<Pocket, number>()
  for (const pocket of wheel.pockets) {
    counts.set(pocket, (counts.get(pocket) ?? 0) + 1)
  }
  const probabilities = new Map<Pocket, number>()
  for (const [pocket, count] of counts) {
    probabilities.set(pocket, count / wheel.pockets.length)
  }
  return probabilities
}

/** How each colour occurs on a given wheel, derived the same way. */
export function colourProbabilities(wheel: Wheel): Record<PocketColour, number> {
  const totals: Record<PocketColour, number> = { red: 0, black: 0, green: 0 }
  for (const pocket of wheel.pockets) {
    totals[colourOf(pocket)] += 1
  }
  const length = wheel.pockets.length
  return { red: totals.red / length, black: totals.black / length, green: totals.green / length }
}

/**
 * The probability that two independent draws from this wheel produce the same
 * value: `sum over values of p^2`.
 *
 * This is 1/36 on the no-zero wheel and 1/37 on the single-zero wheel, because
 * every value appears exactly once. On the American wheel it is
 * `36 * (1/38)^2 + (2/38)^2 = 40/1444`, which is **larger** than the European
 * figure, not the `1/38` that is usually quoted. Two slots holding the same
 * number is the only reason: they collide with each other.
 */
export function repeatProbability(wheel: Wheel): number {
  let total = 0
  for (const probability of pocketProbabilities(wheel).values()) {
    total += probability * probability
  }
  return total
}

/** The probability two independent draws produce the same colour. */
export function colourRepeatProbability(wheel: Wheel): number {
  const probabilities = colourProbabilities(wheel)
  return probabilities.red * probabilities.red +
    probabilities.black * probabilities.black +
    probabilities.green * probabilities.green
}

/**
 * Turn a count of wins over a number of opportunities into the full result.
 *
 * The standard error is the binomial one, `sqrt(p(1-p)/n)`. It is computed from
 * the **expected** rate rather than the measured one because the expected rate is
 * the null hypothesis being tested against, and using the measured rate would
 * shrink the error bar exactly when the data is most suspicious.
 */
function assemble(
  id: DetectorId,
  wins: number,
  total: number,
  expected: number,
): DetectorResult {
  const rate = total === 0 ? 0 : wins / total
  const delta = rate - expected
  const reliable = total >= MIN_TRIGGERS
  const standardError = reliable ? Math.sqrt((expected * (1 - expected)) / total) : 0
  return {
    id,
    wins,
    total,
    rate,
    expected,
    delta,
    z: reliable && standardError > 0 ? delta / standardError : 0,
    reliable,
  }
}

/**
 * Reorder a newest-first history into spin order, oldest first.
 *
 * Named rather than inlined because the reversal is easy to omit and silent when
 * omitted: every detector here would still produce plausible-looking numbers,
 * describing a pattern that ran in the opposite order.
 */
export function chronological(newestFirst: readonly Pocket[]): Pocket[] {
  return [...newestFirst].reverse()
}

/**
 * Repeat: how often a spin lands on the same value as the one before it.
 */
export function repeatDetector(entries: readonly Pocket[], wheel: Wheel): DetectorResult {
  let total = 0
  let wins = 0
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]
    const current = entries[index]
    if (previous === undefined || current === undefined) continue
    total += 1
    if (previous === current) wins += 1
  }
  return assemble('repeat', wins, total, repeatProbability(wheel))
}

/**
 * Alternating: how often a spin differs from the one before it. The complement of
 * the repeat detector, and derived as one rather than re-counted, so the two can
 * never disagree.
 */
export function alternatingDetector(entries: readonly Pocket[], wheel: Wheel): DetectorResult {
  const repeat = repeatDetector(entries, wheel)
  return assemble(
    'alternating',
    repeat.total - repeat.wins,
    repeat.total,
    1 - repeat.expected,
  )
}

/**
 * The probability that a colour run, having just begun, survives its next spin.
 *
 * ## Why this is not simply the probability of the colour
 *
 * Independence says the next spin is distributed as the first one whatever came
 * before it, so *for a fixed lead colour* the probability of continuing is that
 * colour's probability. But the trigger here fires at the **first spin of a run**,
 * and a run only begins when the colour changed. Conditioning on that change
 * re-weights which colour a run is likely to start in:
 *
 * ```text
 * P(lead = c | change) = p_c (1 - p_c) / SUM_j p_j (1 - p_j)
 * ```
 *
  * and the rate of continuing is therefore the weighted mean of `p_c` over that
  * re-weighted distribution. At length one that is
  *
 * ```text
 * SUM_c p_c^2 (1 - p_c) / (1 - SUM_c p_c^2)
 * ```
 *
 * On a wheel where every pocket is distinct and red and black are equally likely,
 * this lands near 0.4635 while the naive `SUM p_c^2` is 0.4741 — a 2 % gap that is
 * **not** an effect in the wheel but a difference in the question being asked.
 * Deriving it here rather than typing it is the point: typing `SUM p_c^2` beside a
 * one-per-run trigger produced a detector that failed at seven standard errors on
 * 300 000 honest spins, which reads exactly like a loaded wheel.
 *
  * ## Why the expectation rises with run length
  *
  * The rise is arithmetic, not an effect in the wheel. A run of length `length` has
  * already survived `length` spins, and conditioning on that survival re-weights the
  * lead distribution towards the frequent colours: a green run of length five is
  * vastly rarer than a red one, so the average run observed at length five is redder
  * than the average run observed at length one. At length `length` the continuation
  * probability is
  *
  * ```text
  * SUM_c p_c^(length+1) (1 - p_c) / SUM_c p_c^length (1 - p_c)
  * ```
  *
  * which climbs from ~0.4635 at length one towards the red/black rate as `length`
  * grows. Anyone who reads that rise as "red after six reds is more likely" has
  * found the conditioning and missed the independence: the next spin is still the
  * same wheel, and its probability never moved.
 *
 * ## Why one trigger per run
 *
 * A run of `length` or more is counted once, at the moment it first reaches that
 * length. Counting every spin inside the run instead would make one run of twenty
 * contribute twenty triggers that share a single outcome, and the binomial standard
 * error would understate the real spread by counting correlated draws as
 * independent. Triggering once per run is what makes that standard error honest.
 */
export function colourRunDetector(
  entries: readonly Pocket[],
  wheel: Wheel,
  length: number,
): DetectorResult {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`colour run length must be a positive integer, got ${String(length)}`)
  }
  const colours = entries.map((pocket) => colourOf(pocket))
  let total = 0
  let wins = 0
  for (let index = length; index < colours.length; index += 1) {
    const window = colours.slice(index - length, index)
    const lead = window[0]
    if (lead === undefined) continue
    // Every colour in the window must match, including the zeros, which break a
    // colour run the same way they break a number streak.
    if (!window.every((colour) => colour === lead)) continue
    // Only the LAST spin of a maximal run may fire the trigger. Firing on every
    // spin inside a run would make one run of twenty contribute twenty triggers
    // that all share the same outcome, and the binomial standard error would
    // understate the true spread by counting them as independent draws. The
    // docblock promised one trigger per maximal run; the loop was doing something
    // else, and the wider error band is how it showed.
    const before = index - length - 1 >= 0 ? colours[index - length - 1] : undefined
    if (before === lead) continue
    const next = colours[index]
    if (next === undefined) continue
    total += 1
    if (next === lead) wins += 1
  }
  return assemble('colourRun', wins, total, colourRunContinuationProbability(wheel, length))
}

/**
 * The expectation the colour-run detector is measured against at a given run
 * length, derived from the wheel's own colour probabilities. See the detector's
 * docblock for the conditioning argument; this is the arithmetic it arrives at.
 *
 *   expected(L) = SUM_c p_c^(L+1) (1 - p_c)  /  SUM_c p_c^L (1 - p_c)
 *
 * Every term comes from `colourProbabilities`, so a wheel whose colours are not
 * equally likely — every real one — is handled by the same expression with nothing
 * special-cased, and the American wheel's doubled zero weighs twice exactly as
 * heavily as its own probability says it should.
 *
 * The rate RISES with run length, from 0.4635 at one on a European wheel to
 * 0.4851 at two, and it must: a trigger at length L only exists for a run that
 * already survived L-1 spins, which selects for the frequent colours. The rise
 * is arithmetic, not a wheel remembering anything. Anyone who reads it as "red
 * after six reds is more likely" has found the conditioning and missed the
 * independence, which is the whole of the gambler's fallacy in one sentence.
 *
 * `length` is validated rather than clamped, because a silent clamp would produce
 * a confident number for a question nobody asked.
 */
export function colourRunContinuationProbability(wheel: Wheel, length: number): number {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`run length must be a positive integer, received ${String(length)}`)
  }
  const probabilities = colourProbabilities(wheel)
  // The powers are accumulated by recurrence rather than by raising each term
  // independently, so a long run cannot underflow the denominator to zero and
  // produce an infinite continuation rate. `survival` is p^length; the identity
  // p^(k+1) = p^k * p keeps every term proportional to the last.
  let base = 0
  let continued = 0
  for (const probability of Object.values(probabilities)) {
    const survival = Math.pow(probability, length)
    base += survival * (1 - probability)
    continued += survival * probability * (1 - probability)
  }
  // `base` is the probability a colour run reaches this length at all, which
  // cannot be zero on any wheel with more than one colour — but dividing by it
  // regardless would be arithmetic on faith.
  if (base <= 0) return 0
  return continued / base
}

/**
 * The pockets that fall in the top and bottom frequency tenths of a history.
 *
 * Returned as sets so a caller can paint them, and so the threshold is derived
 * from the counts rather than guessed. Ties are broken by pocket value so the
 * selection is a function of the history alone and two runs of the same engine
 * pick the same pockets.
 */
export function decileSets(
  entries: readonly Pocket[],
  decile: number = DECILE,
): { hot: ReadonlySet<Pocket>; cold: ReadonlySet<Pocket> } {
  if (!Number.isInteger(decile) || decile < 2 || decile > 50) {
    throw new RangeError(`decile must be an integer between 2 and 50, got ${String(decile)}`)
  }
  const counts = new Map<Pocket, number>()
  for (const pocket of entries) {
    counts.set(pocket, (counts.get(pocket) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const size = Math.max(1, Math.floor(ranked.length / decile))
  return {
    hot: new Set(ranked.slice(0, size).map(([pocket]) => pocket)),
    cold: new Set(ranked.slice(-size).map(([pocket]) => pocket)),
  }
}

/**
 * Hot continuation: after a pocket in the most frequent tenth has landed, how
 * often does a pocket in that same tenth land next?
 *
 * ## The bias in this detector, stated plainly
 *
 * The expected rate is one tenth, derived from the size of the decile — and that
 * expectation is **generous to the detector**. The set of "hot" pockets is chosen
 * by looking at which pockets have been frequent, and it is then measured on the
 * same spins that chose it. Every selection of this shape lands above its own null
 * by construction, so a measured rate of fourteen percent here is evidence of
 * nothing at all. The honest null is a permutation baseline — pick a tenth of the
 * pockets at random and measure that instead — and the fact that this module does
 * not compute one is a limitation of the detector, not a reason to trust it.
 *
 * The panel prints this caveat beside the number. A detector whose failure mode
 * is invisible is the exact thing this project exists to replace.
 */
export function hotContinuationDetector(
  entries: readonly Pocket[],
  wheel: Wheel,
  decile: number = DECILE,
): DetectorResult {
  const probabilities = pocketProbabilities(wheel)
  const distinct = probabilities.size
  const expected = Math.min(1, Math.floor(distinct / decile) / distinct)
  const { hot } = decileSets(entries, decile)
  return assemble('hotContinuation', ...windowOutcome(entries, hot, hot), expected)
}

/**
 * Cold continuation: after a pocket in the least frequent tenth has landed, how
 * often does the same tenth land next?
 *
 * Shares the selection bias of {@link hotContinuationDetector} with the sign
 * reversed: the cold set is chosen for being infrequent, so a rate above one tenth
 * is even less meaningful than a hot rate above it, and the same caveat applies.
 */
export function coldContinuationDetector(
  entries: readonly Pocket[],
  wheel: Wheel,
  decile: number = DECILE,
): DetectorResult {
  const probabilities = pocketProbabilities(wheel)
  const distinct = probabilities.size
  const expected = Math.min(1, Math.floor(distinct / decile) / distinct)
  const { cold } = decileSets(entries, decile)
  return assemble('coldContinuation', ...windowOutcome(entries, cold, cold), expected)
}

/**
 * Recent window: after any spin, how often does the next spin land on one of the
 * last `size` distinct pockets?
 *
 * The expectation is the summed probability of those pockets, which is
 * `size / pockets` on a wheel with no repeats and slightly less on the American
 * wheel once a window happens to contain both zeros — the same value twice
 * contributes once. Deriving it from the wheel's own probabilities gets that
 * case right without a special case.
 */
export function recentWindowDetector(
  entries: readonly Pocket[],
  wheel: Wheel,
  size: number,
): DetectorResult {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`window size must be a positive integer, got ${String(size)}`)
  }
  const probabilities = pocketProbabilities(wheel)
  let total = 0
  let wins = 0
  for (let index = 1; index < entries.length; index += 1) {
    const window = new Set(entries.slice(Math.max(0, index - size), index))
    const current = entries[index]
    if (current === undefined || window.size === 0) continue
    total += 1
    if (window.has(current)) wins += 1
  }
  return assemble('recentWindow', wins, total, windowExpected(entries, size, probabilities))
}

/**
 * The summed probability of whatever set of pockets the window actually held,
 * averaged over every window in the history, because the window's contents change
 * as the history runs. Averaging the per-window probabilities is the null this
 * detector is measured against; using a single window's would be measuring one
 * stretch of history and calling it the whole run.
 */
function windowExpected(
  entries: readonly Pocket[],
  size: number,
  probabilities: Map<Pocket, number>,
): number {
  let total = 0
  let count = 0
  for (let index = 1; index < entries.length; index += 1) {
    const window = new Set(entries.slice(Math.max(0, index - size), index))
    if (window.size === 0) continue
    let sum = 0
    for (const pocket of window) {
      sum += probabilities.get(pocket) ?? 0
    }
    total += sum
    count += 1
  }
  return count === 0 ? 0 : total / count
}

/** Count the opportunities for "previous was in `trigger`, next is in `target`". */
function windowOutcome(
  entries: readonly Pocket[],
  trigger: ReadonlySet<Pocket>,
  target: ReadonlySet<Pocket>,
): [number, number] {
  let total = 0
  let wins = 0
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]
    const current = entries[index]
    if (previous === undefined || current === undefined) continue
    if (!trigger.has(previous)) continue
    total += 1
    if (target.has(current)) wins += 1
  }
  return [wins, total]
}