/**
 * Transition matrices.
 *
 * The single strongest structure detector that exists: if the wheel has memory
 * — if a red makes a black more likely than a red does — then the matrix of
 * what follows what is not the product of the two marginals, and the shape of
 * the departure says where. A full first-order matrix over all 37 numbers is
 * 37 x 37 cells, and running it on real spins returns to uniform. That is the
 * point: this module exists to make the return measurable rather than to find
 * a defect.
 *
 * Three decisions worth stating, because each of them is a place where a
 * plausible shortcut would have produced a confident wrong answer.
 *
 * The expected cell is `P(from) * P(to) * n`, with the probabilities taken from
 * the WHEEL rather than from the sample's own marginals. The usual contingency
 * table expectation is `rowTotal * colTotal / n`, and that is what most
 * software will hand you. It is self-referential: the sample's marginals are
 * fitted to the sample, so a wheel whose colours were badly distributed would
 * quietly be tested against its own imbalance instead of against uniformity.
 * Taking the probabilities from the wheel's pocket list is the same rule the
 * rest of this repository follows and for the same reason.
 *
 * The matrix is built over the labels that actually occur, and the ones that do
 * not are returned as `absent`. A state that never appeared has no row to
 * measure, and putting its zero-expected cells into the statistic would either
 * divide by zero or contribute an infinite term for a fact about sampling, not
 * about dependence. The probabilities are renormalised over the labels kept, so
 * the test asks the right question: given only these colours, does knowing the
 * previous one change the odds of the next?
 *
 * Order is chronological. `History` is newest-first, so passing it straight in
 * measures the past given the future. `chronological` lives in detectors.ts and
 * is used here too, so the reversal is one named and tested operation.
 *
 * Nothing here predicts. It answers one question: if the wheel is fair, how
 * often would this transition be seen?
 */
import { chronological } from './detectors.js'
import {
  MIN_EXPECTED_PER_BIN,
  chiSquarePValue,
  verdict,
  type ChiSquareTest,
  type Verdict,
} from './hypothesis.js'
import { colourOf, type Pocket, type Wheel } from '../roulette/wheels.js'

/** Maps a pocket onto a state of the chain. */
export type Classifier = (pocket: Pocket) => string

/**
 * Red, black, green — the classification every roulette tracker ships first,
 * because it is the one with the fewest states and therefore the most cells per
 * state at a human sample size.
 */
export function classifyByColour(pocket: Pocket): string {
  return colourOf(pocket)
}

/**
 * Odd, even, zero. The zero gets its own state rather than being folded into
 * either: it is the reason the wheel has an edge, and hiding it inside "even"
 * would be the same mistake as publishing a repeat rate of 1/pocketCount on a
 * double-zero wheel.
 */
export function classifyByParity(pocket: Pocket): string {
  if (pocket === 0) return 'zero'
  return pocket % 2 === 0 ? 'even' : 'odd'
}

/**
 * A nested map rather than a `${from} ${to}` string key. A caller-chosen
 * classifier may return a label containing a space, and then "light red" and
 * "red" collide in a joined key: looking up "red" would find "light red"'s
 * counts and the matrix would quietly describe a different game. Two maps cost
 * nothing at this size and remove the collision entirely.
 */
type TransitionCounts = Map<string, Map<string, number>>

export interface MarkovCell {
  /** The state that came first, in chronological order. */
  readonly from: string
  /** The state that followed. */
  readonly to: string
  readonly observed: number
  /** `P(from) * P(to)` from the wheel, times the number of transitions. */
  readonly expected: number
  /**
   * Observed minus expected. Negative means the transition happened less often
   * than independence predicts.
   */
  readonly excess: number
}

export interface MarkovResult {
  /** The states kept, sorted so two runs of the same engine order them alike. */
  readonly states: readonly string[]
  /** Labels the classifier can produce that did not occur, so nothing is silently dropped. */
  readonly absent: readonly string[]
  readonly cells: readonly MarkovCell[]
  /** Observed transitions, which is one fewer than the number of spins. */
  readonly transitions: number
  /** Each kept state's share of the wheel, renormalised over `states`. */
  readonly probabilities: ReadonlyMap<string, number>
  readonly chi2: number
  readonly degreesOfFreedom: number
  readonly pValue: number
  readonly minExpected: number
  readonly verdict: Verdict
  /** The cell with the largest absolute excess, which is the one to read first. */
  readonly strongest: MarkovCell | null
}

/**
 * The probability of each label the classifier can produce, derived by counting
 * the wheel's pockets rather than by counting the labels. On the American wheel
 * that gives the zero a share of 2/38, because the wheel carries it twice, and
 * nothing here has to know that a double zero exists.
 */
export function stateProbabilities(wheel: Wheel, classify: Classifier): Map<string, number> {
  const counts = new Map<string, number>()
  for (const pocket of wheel.pockets) {
    const label = classify(pocket)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const total = wheel.pockets.length
  const probabilities = new Map<string, number>()
  for (const [label, count] of counts) probabilities.set(label, count / total)
  return probabilities
}

/**
 * The observed transition matrix beside the one independence predicts.
 *
 * `entries` is chronological: oldest first. Use `chronological` to convert a
 * `History`.
 */
export function transitionMatrix(
  entries: readonly Pocket[],
  wheel: Wheel,
  classify: Classifier,
): MarkovResult {
  const order = chronological(entries)
  const counts: TransitionCounts = new Map()
  for (let i = 1; i < order.length; i += 1) {
    // Both indices are in range by construction: i >= 1 and i < order.length.
    const from = classify(order[i - 1] as Pocket)
    const to = classify(order[i] as Pocket)
    const row = counts.get(from)
    if (row === undefined) counts.set(from, new Map([[to, 1]]))
    else row.set(to, (row.get(to) ?? 0) + 1)
  }

  const transitions = Math.max(0, order.length - 1)
  const wheelProbabilities = stateProbabilities(wheel, classify)
  const states = [...wheelProbabilities.keys()].filter((label) => counts.has(label)).sort()
  const absent = [...wheelProbabilities.keys()].filter((label) => !states.includes(label)).sort()

  const kept = states.reduce((sum, label) => sum + (wheelProbabilities.get(label) ?? 0), 0)
  const probabilities = new Map<string, number>()
  for (const label of states) {
    // `kept` is zero only when nothing was kept, which the empty branch below
    // handles; the guard keeps the division from producing NaN on the way there.
    probabilities.set(label, kept === 0 ? 0 : (wheelProbabilities.get(label) ?? 0) / kept)
  }

  const cells: MarkovCell[] = []
  let chi2 = 0
  let minExpected = Number.POSITIVE_INFINITY
  for (const from of states) {
    for (const to of states) {
      const observed = counts.get(from)?.get(to) ?? 0
      const expected = (probabilities.get(from) ?? 0) * (probabilities.get(to) ?? 0) * transitions
      if (expected <= 0) continue
      const squared = (observed - expected) * (observed - expected)
      cells.push({ from, to, observed, expected, excess: observed - expected })
      chi2 += squared / expected
      if (expected < minExpected) minExpected = expected
    }
  }

  // Fewer than two states means there is nothing to compare. Guarding on
  // `cells.length === 0` was not enough: one state yields exactly one cell
  // (state to itself), so it passed the guard and reached
  // `chiSquarePValue(chi2, 0)`, which RangeErrors -- and a history with no
  // green on the colour matrix is an ordinary session, not a broken one. A
  // refusal is the honest answer when only one state was ever seen.
  if (states.length < 2) {
    return {
      states,
      absent,
      cells,
      transitions,
      probabilities,
      chi2: 0,
      degreesOfFreedom: 0,
      pValue: 1,
      minExpected: 0,
      verdict: { level: 'refused', shortfall: 0 },
      strongest: null,
    }
  }

  // An r x c contingency table has (r-1)(c-1) degrees of freedom. The state
  // sets are the same on both axes, so this is (r-1)^2.
  const degreesOfFreedom = (states.length - 1) * (states.length - 1)
  const pValue = chiSquarePValue(chi2, degreesOfFreedom)

  let smallestProbability = 1
  for (const probability of probabilities.values()) {
    if (probability < smallestProbability) smallestProbability = probability
  }
  const needed = Math.ceil(MIN_EXPECTED_PER_BIN / smallestProbability)
  const reliable = minExpected >= MIN_EXPECTED_PER_BIN

  // `verdict` reads only the reliability, the shortfall and the p-value, but it
  // takes the whole test. The cells are mapped rather than dropped: a cell IS an
  // outcome with an id, a count, a probability and an expectation, so nothing is
  // lost and there stays one implementation of "what does this p-value mean".
  const test: ChiSquareTest = {
    chi2,
    df: degreesOfFreedom,
    pValue,
    total: transitions,
    outcomes: cells.map((cell) => ({
      id: `${cell.from} to ${cell.to}`,
      count: cell.observed,
      probability: transitions === 0 ? 0 : cell.expected / transitions,
      expected: cell.expected,
    })),
    minExpected,
    reliable,
    shortfall: reliable ? 0 : Math.max(0, needed - transitions),
  }

  let strongest: MarkovCell | null = null
  for (const cell of cells) {
    if (strongest === null || Math.abs(cell.excess) > Math.abs(strongest.excess)) strongest = cell
  }

  return {
    states,
    absent,
    cells,
    transitions,
    probabilities,
    chi2,
    degreesOfFreedom,
    pValue,
    minExpected,
    verdict: verdict(test),
    strongest,
  }
}