import { describe, expect, it } from 'vitest'
import {
  MIN_EXPECTED_PER_BIN,
  STRONG_P_VALUE,
  WEAK_P_VALUE,
  chiSquareAgainst,
  chiSquarePValue,
  colourBins,
  parityBins,
  pocketBins,
  pocketZScores,
  verdict,
} from '../src/stats/hypothesis.js'
import { AMERICAN, EUROPEAN, NO_ZERO, type Pocket } from '../src/roulette/wheels.js'
import { createRng } from '../src/util/rng.js'

/**
 * The p-value is the one number in this repository whose value comes from
 * somewhere else: it is read out of a published chi-square table rather than
 * computed from anything here. Everything else in the statistics module is
 * checked against itself, which would prove nothing if the gamma functions
 * underneath were wrong -- a p-value implementation that is consistently
 * incorrect agrees with itself perfectly.
 *
 * So these tests assert the survival function against published critical
 * values. If `chiSquarePValue` returns the right answer at three published
 * points on three different degrees of freedom, it is right.
 */
/**
 * The chi-square survival function for an EVEN number of degrees of freedom,
 * written out as the finite sum it actually is, with no gamma function
 * involved.
 *
 * With `df = 2k` the distribution is an Erlang shape, so the integral in the
 * definition terminates after k terms:
 *
 *     P(X > x) = exp(-x/2) * SUM(i = 0..k-1) of (x/2)^i / i!
 *
 * This exists because checking a gamma implementation against a table copied
 * from memory is not a check. A table entry can be wrong, and if the wrong
 * entry and the implementation disagree, the temptation is to assume the code
 * is at fault -- which is how a wrong table becomes a wrong implementation.
 * This function shares no code with the module under test, so it settles the
 * question instead of restating it.
 */
function erlangSurvival(chi2: number, df: number): number {
  if (df % 2 !== 0) throw new Error('the finite sum is exact only for even degrees of freedom')
  const half = chi2 / 2
  let term = 1
  let sum = 1
  for (let i = 1; i < df / 2; i += 1) {
    term *= half / i
    sum += term
  }
  return Math.exp(-half) * sum
}

describe('the p-value agrees with published critical values', () => {
  // The chi-square table, upper-tail. Each row is "at this probability, the
  // statistic reaches this value" -- so the p-value we compute at that statistic
  // must come back as that probability.
  const table: readonly { readonly df: number; readonly p: number; readonly chi2: number }[] = [
    { df: 1, p: 0.05, chi2: 3.841 },
    { df: 2, p: 0.05, chi2: 5.991 },
    { df: 10, p: 0.05, chi2: 18.307 },
    { df: 36, p: 0.05, chi2: 50.998 },
  ]

  for (const row of table) {
    it(`reproduces p = ${row.p} at df = ${row.df}, chi2 = ${row.chi2}`, () => {
      expect(chiSquarePValue(row.chi2, row.df)).toBeCloseTo(row.p, 3)
    })
  }

  it('matches the exact finite sum at every even df, with no table involved', () => {
    const probes: readonly { readonly df: number; readonly chi2: number }[] = [
      { df: 2, chi2: 0.5 },
      { df: 2, chi2: 5.991 },
      { df: 4, chi2: 9.488 },
      { df: 4, chi2: 40 },
      { df: 18, chi2: 12 },
      { df: 36, chi2: 20.479 },
      { df: 36, chi2: 46.459 },
      { df: 36, chi2: 50.998 },
      { df: 36, chi2: 58.201 },
      { df: 36, chi2: 90 },
    ]
    for (const probe of probes) {
      expect(chiSquarePValue(probe.chi2, probe.df)).toBeCloseTo(
        erlangSurvival(probe.chi2, probe.df),
        9,
      )
    }
  })

  it('returns the probability the exact sum gives at the two rows the table disputed', () => {
    // Written as its own test, and deliberately NOT asserting a remembered
    // probability. The finite sum above is the authority for these two rows,
    // and it disagrees with the table entries I first wrote down -- so the
    // implementation was right and the table in my head was wrong. Recorded
    // here because "my memory of a reference table" is a thing that has been
    // wrong in this repository before.
    expect(chiSquarePValue(46.459, 36)).toBeCloseTo(erlangSurvival(46.459, 36), 9)
    expect(chiSquarePValue(58.201, 36)).toBeCloseTo(erlangSurvival(58.201, 36), 9)
  })

  it('reports a full probability for a statistic of zero', () => {
    expect(chiSquarePValue(0, 36)).toBe(1)
  })

  it('falls as the statistic rises', () => {
    const atTwenty = chiSquarePValue(20, 36)
    const atFifty = chiSquarePValue(50, 36)
    expect(atFifty).toBeLessThan(atTwenty)
  })

  it('rejects a statistic that cannot exist', () => {
    expect(() => chiSquarePValue(-1, 36)).toThrow(RangeError)
    expect(() => chiSquarePValue(Number.NaN, 36)).toThrow(RangeError)
    expect(() => chiSquarePValue(50, 0)).toThrow(RangeError)
    expect(() => chiSquarePValue(50, -2)).toThrow(RangeError)
  })
})

/** Builds a history by repeating each pocket the same number of times. */
function repeatEach(pockets: readonly Pocket[], times: number): Pocket[] {
  const out: Pocket[] = []
  for (const pocket of pockets) {
    for (let i = 0; i < times; i += 1) out.push(pocket)
  }
  return out
}

/** The thirty-six ordinary numbers, which is what a parity split is about. */
const ORDINARY: readonly Pocket[] = Array.from({ length: 36 }, (_, index) => index + 1)

describe('a fair wheel produces a p-value at one', () => {
  // Every odd number as often as every even number: the split is exactly even,
  // so the statistic is exactly zero and the p-value exactly one. Both numbers
  // are derived from the construction rather than measured from it.
  const balanced = repeatEach(ORDINARY, 45)

  it('scores an exactly even parity split as a perfect fit', () => {
    const test = chiSquareAgainst(balanced, EUROPEAN, parityBins())
    expect(test.chi2).toBe(0)
    expect(test.pValue).toBe(1)
    expect(test.df).toBe(1)
  })

  it('is reliable at this sample size', () => {
    const test = chiSquareAgainst(balanced, EUROPEAN, parityBins())
    expect(test.minExpected).toBeGreaterThanOrEqual(MIN_EXPECTED_PER_BIN)
    expect(test.reliable).toBe(true)
    expect(verdict(test).level).toBe('uniform')
  })

  it('splits the outcomes the way the wheel does, not the way a guess would', () => {
    const test = chiSquareAgainst(balanced, EUROPEAN, parityBins())
    for (const outcome of test.outcomes) {
      expect(outcome.probability).toBeCloseTo(0.5, 12)
    }
  })

  it('survives a genuine random sample from the seeded generator', () => {
    // Real draws, not a construction. Thirty thousand spins of a fair wheel is
    // enough that a broken statistic would show; a correct one will not be
    // rejected, so the assertion is that the p-value stays high rather than that
    // it equals any particular number.
    const rng = createRng('chi-square-uniform')
    const spins: Pocket[] = []
    for (let i = 0; i < 30000; i += 1) {
      spins.push(EUROPEAN.pockets[rng.int(EUROPEAN.pockets.length)] as Pocket)
    }
    const test = chiSquareAgainst(spins, EUROPEAN, parityBins())
    expect(test.pValue).toBeGreaterThan(WEAK_P_VALUE)
    expect(verdict(test).level).toBe('uniform')
  })
})

describe('a wheel that only ever lands on one number is caught', () => {
  const rigged: Pocket[] = Array.from({ length: 300 }, () => 17)

  it('returns a p-value indistinguishable from zero', () => {
    const test = chiSquareAgainst(rigged, EUROPEAN, pocketBins(EUROPEAN))
    expect(test.pValue).toBeLessThan(STRONG_P_VALUE)
    expect(verdict(test).level).toBe('strong')
  })

  it('puts that number at the top of the deviation list', () => {
    const scores = pocketZScores(rigged, EUROPEAN)
    expect(scores[0]?.pocket).toBe(17)
    expect(Math.abs(scores[0]?.z ?? 0)).toBeGreaterThan(100)
  })

  it('gives every other number a z of the opposite sign to the rigged one', () => {
    const scores = pocketZScores(rigged, EUROPEAN)
    const rigged17 = scores.find((score) => score.pocket === 17)
    expect(rigged17?.z).toBeGreaterThan(0)
    for (const score of scores) {
      if (score.pocket === 17) continue
      expect(score.z).toBeLessThan(0)
    }
  })
})

describe('the deviation scores are arithmetic, not a ranking of favourites', () => {
  it('sums to zero on a wheel whose numbers are all equally likely', () => {
    // Every z is a deviation over the SAME standard deviation, so the scores
    // sum to the deviations over that denominator -- and the deviations sum to
    // zero because the counts are the spins and the expectations are the same
    // spins scaled to add up to the same total. Stating that here is the point:
    // it is why a deviation list with one enormous entry is not the same thing
    // as a list of winners.
    const rng = createRng('z-sum')
    const spins: Pocket[] = []
    for (let i = 0; i < 5000; i += 1) {
      spins.push(NO_ZERO.pockets[rng.int(NO_ZERO.pockets.length)] as Pocket)
    }
    const total = scoresSum(pocketZScores(spins, NO_ZERO))
    expect(total).toBeCloseTo(0, 8)
  })

  it('does not sum to zero on a wheel where one number occupies two pockets', () => {
    // The American double zero has twice the probability of every other number,
    // so it has a different standard deviation too and the weights no longer
    // cancel. Asserted rather than left implicit: someone seeing this test fail
    // after "fixing" the z-scores should learn that the imbalance is correct.
    //
    // The spins must come from the wheel being scored. An earlier version drew
    // them from the American wheel and then scored them against the no-zero
    // wheel, and got a sum of 21.6 out of a mismatched pair rather than from
    // anything wrong with the arithmetic.
    const rng = createRng('z-sum-double-zero')
    const spins: Pocket[] = []
    for (let i = 0; i < 5000; i += 1) {
      spins.push(AMERICAN.pockets[rng.int(AMERICAN.pockets.length)] as Pocket)
    }
    const total = scoresSum(pocketZScores(spins, AMERICAN))
    expect(Math.abs(total)).toBeGreaterThan(1e-6)
  })

  it('weights the American double zero by its two pockets when scoring it', () => {
    // The zero's expected count is the spins scaled by two pockets in thirty-
    // eight, not by one in thirty-seven. Derived from the layout, so a wheel
    // with two zeroes elsewhere would need no change here.
    const rng = createRng('z-double-zero-weight')
    const spins: Pocket[] = []
    for (let i = 0; i < 5000; i += 1) {
      spins.push(AMERICAN.pockets[rng.int(AMERICAN.pockets.length)] as Pocket)
    }
    const scores = pocketZScores(spins, AMERICAN)
    const zero = scores.find((score) => score.pocket === 0)
    const ordinary = scores.find((score) => score.pocket === 17)
    expect(zero).toBeDefined()
    expect(ordinary).toBeDefined()
    // Two thirty-eighths against one thirty-eighth: exactly twice the share, so
    // exactly twice the expectation.
    expect(zero?.expected).toBeCloseTo((ordinary?.expected ?? 0) * 2, 8)
    expect(zero?.sd ?? 0).toBeGreaterThan(ordinary?.sd ?? 0)
  })

  it('scores the same spins to the same answer on a wheel with one zero per value', () => {
    // The no-zero wheel gives every number the same share, so the sum cancels
    // exactly. This is the wheel the first version of the American test
    // accidentally used against the wrong spins.
    const rng = createRng('z-sum-single-zero')
    const spins: Pocket[] = []
    for (let i = 0; i < 5000; i += 1) {
      spins.push(EUROPEAN.pockets[rng.int(EUROPEAN.pockets.length)] as Pocket)
    }
    expect(Math.abs(scoresSum(pocketZScores(spins, EUROPEAN)))).toBeLessThan(1e-8)
  })

  it('orders by how far the count sits from expectation, largest first', () => {
    const scores = pocketZScores(repeatEach(ORDINARY, 3), NO_ZERO)
    for (let i = 1; i < scores.length; i += 1) {
      const previous = Math.abs(scores[i - 1]?.z ?? 0)
      const current = Math.abs(scores[i]?.z ?? 0)
      expect(previous).toBeGreaterThanOrEqual(current)
    }
  })

  it('refuses to score nothing', () => {
    expect(() => pocketZScores([], NO_ZERO)).toThrow(RangeError)
  })
})

function scoresSum(scores: readonly { readonly z: number }[]): number {
  let total = 0
  for (const score of scores) total += score.z
  return total
}

describe('counts too thin to test are refused rather than reported', () => {
  // This is the refusal the whole module exists for. Twenty spins of a single
  // number is a spectacular deviation from fairness, and reporting it would be
  // indistinguishable from reporting nonsense: at this size almost any run of
  // identical results is unremarkable, so the honest answer is "come back with
  // more", not "the wheel is rigged".
  const thin: Pocket[] = Array.from({ length: 20 }, () => 17)

  it('still computes a statistic, so the reader can see what was measured', () => {
    const test = chiSquareAgainst(thin, EUROPEAN, pocketBins(EUROPEAN))
    expect(test.chi2).toBeGreaterThan(0)
    expect(test.pValue).toBeLessThan(STRONG_P_VALUE)
  })

  it('refuses to call it a finding', () => {
    const test = chiSquareAgainst(thin, EUROPEAN, pocketBins(EUROPEAN))
    expect(test.reliable).toBe(false)
    expect(verdict(test).level).toBe('refused')
  })

  it('says how many more spins the smallest outcome needs', () => {
    const test = chiSquareAgainst(thin, EUROPEAN, pocketBins(EUROPEAN))
    // Every number on this wheel is one pocket of thirty-seven, so five
    // expected counts needs five times thirty-seven spins. Derived from the
    // wheel's own layout rather than typed.
    const needed = MIN_EXPECTED_PER_BIN * EUROPEAN.pockets.length
    expect(test.shortfall).toBe(needed - thin.length)
  })

  it('is honest about the difference between a refusal and a pass', () => {
    const test = chiSquareAgainst(thin, EUROPEAN, pocketBins(EUROPEAN))
    const result = verdict(test)
    expect(result.shortfall).toBeGreaterThan(0)
    expect(verdict(chiSquareAgainst(repeatEach(ORDINARY, 45), EUROPEAN, parityBins())).shortfall).toBe(0)
  })
})

describe('the outcome sets describe the wheel they are given', () => {
  it('has one outcome per distinct number, not per pocket', () => {
    const american = pocketBins(AMERICAN)
    expect(american).toHaveLength(AMERICAN.pockets.length - 1)
    expect(new Set(american.map((bin) => bin.id)).size).toBe(american.length)
  })

  it('gives the double zero a single outcome', () => {
    const zeroBins = pocketBins(AMERICAN).filter((bin) => bin.classify(0))
    expect(zeroBins).toHaveLength(1)
  })

  it('counts red and black by what the wheel actually holds', () => {
    const test = chiSquareAgainst(repeatEach(ORDINARY, 1), EUROPEAN, colourBins())
    const red = test.outcomes.find((outcome) => outcome.id === 'red')
    const green = test.outcomes.find((outcome) => outcome.id === 'green')
    // Eighteen red pockets and one green out of thirty-seven. Derived from the
    // wheel's own counts rather than written in, so a wheel with a different
    // layout would need no change here.
    const redPockets = EUROPEAN.pockets.filter((pocket) => {
      const [bin] = colourBins().filter((candidate) => candidate.id === 'red' && candidate.classify(pocket))
      return bin !== undefined
    }).length
    expect(red?.probability).toBeCloseTo(redPockets / EUROPEAN.pockets.length, 12)
    expect(green?.probability).toBeCloseTo(1 / EUROPEAN.pockets.length, 12)
  })

  it('leaves the zero out of both parities', () => {
    const [odd, even] = parityBins()
    expect(odd?.classify(0)).toBe(false)
    expect(even?.classify(0)).toBe(false)
  })

  it('divides the ordinary numbers evenly between them', () => {
    const [odd, even] = parityBins()
    for (const pocket of ORDINARY) {
      expect(odd?.classify(pocket) !== even?.classify(pocket)).toBe(true)
    }
  })
})

describe('a test over impossible outcomes is refused at the door', () => {
  it('needs at least one spin', () => {
    expect(() => chiSquareAgainst([], EUROPEAN, parityBins())).toThrow(RangeError)
  })

  it('needs at least two outcomes to compare', () => {
    expect(() => chiSquareAgainst([1], EUROPEAN, parityBins().slice(0, 1))).toThrow(RangeError)
  })

  it('refuses an outcome no pocket on the wheel can match', () => {
    const impossible = [{ id: 'blue', classify: (): boolean => false }]
    expect(() => chiSquareAgainst([1, 2], EUROPEAN, [...parityBins(), ...impossible])).toThrow(RangeError)
  })

  it('refuses when no recorded spin falls into the compared outcomes', () => {
    const onlySevens = [{ id: 'seven', classify: (pocket: Pocket): boolean => pocket === 7 }]
    const alsoSevens = [{ id: 'alsoSeven', classify: (pocket: Pocket): boolean => pocket === 7 }]
    expect(() => chiSquareAgainst([1, 2, 3], EUROPEAN, [...onlySevens, ...alsoSevens])).toThrow(RangeError)
  })
})

describe('the verdict is read from the p-value and the reliability together', () => {
  const uniform = chiSquareAgainst(repeatEach(ORDINARY, 45), EUROPEAN, parityBins())

  it('reports a good fit when the counts are even and the sample is large enough', () => {
    expect(verdict(uniform)).toEqual({ level: 'uniform', shortfall: 0 })
  })

  it('never reports a finding from a sample it called unreliable', () => {
    const thin = chiSquareAgainst(Array.from({ length: 20 }, () => 17), EUROPEAN, pocketBins(EUROPEAN))
    expect(thin.pValue).toBeLessThan(STRONG_P_VALUE)
    expect(thin.reliable).toBe(false)
    expect(verdict(thin).level).toBe('refused')
  })

  it('uses the published thresholds rather than a feel for them', () => {
    expect(WEAK_P_VALUE).toBe(0.1)
    expect(STRONG_P_VALUE).toBe(0.01)
  })
})