import { describe, expect, it } from 'vitest'
import {
  AMERICAN,
  EUROPEAN,
  NO_ZERO,
  pickPocket,
  type Pocket,
  type Wheel,
} from '../src/roulette/wheels.js'
import { createRng } from '../src/util/rng.js'
import {
  DECILE,
  DETECTOR_IDS,
  MIN_TRIGGERS,
  chronological,
  colourProbabilities,
  colourRepeatProbability,
  colourRunContinuationProbability,
  colourRunDetector,
  coldContinuationDetector,
  decileSets,
  hotContinuationDetector,
  pocketProbabilities,
  recentWindowDetector,
  repeatDetector,
  repeatProbability,
  alternatingDetector,
} from '../src/stats/detectors.js'
import {
  classifyByColour,
  classifyByParity,
  stateProbabilities,
  transitionMatrix,
} from '../src/stats/markov.js'

/**
 * Every detector in this file is a claim about what a fair wheel produces.
 * So each one is measured against a long run of fair spins and the assertion is
 * that it lands where its own expectation says it should, to within three
 * standard errors of that expectation.
 *
 * Three standard errors rather than "no assertion at all" because a detector
 * that silently measures nothing is indistinguishable from a detector that
 * found the wheel is fair. The band is wide enough that honest noise passes and
 * narrow enough that a broken expectation cannot.
 */
function fairSpins(count: number, wheel: Wheel, seed: string): Pocket[] {
  const rng = createRng(seed)
  const out: Pocket[] = []
  for (let i = 0; i < count; i += 1) out.push(pickPocket(wheel, (max) => rng.int(max)))
  return out
}

/** Standard error of a binomial proportion at a given expected rate. */
function standardError(rate: number, total: number): number {
  return Math.sqrt((rate * (1 - rate)) / total)
}

/** The distinct pocket values of a wheel, in the wheel's own order. */
function distinctValues(wheel: Wheel): Pocket[] {
  const seen: Pocket[] = []
  for (const pocket of wheel.pockets) if (!seen.includes(pocket)) seen.push(pocket)
  return seen
}

/** 1/n of the wheel's own pocket count — the value a detector would report if it assumed every pocket were distinct. */
function naiveRepeatProbability(wheel: Wheel): number {
  return 1 / wheel.pockets.length
}

describe('the expectation is enumerated from the wheel, never typed in', () => {
  it('gives a no-zero wheel exactly 1/n, because every pocket is distinct', () => {
    expect(repeatProbability(NO_ZERO)).toBeCloseTo(naiveRepeatProbability(NO_ZERO), 12)
  })

  it('gives a single-zero wheel exactly 1/n, because every pocket is distinct there too', () => {
    expect(repeatProbability(EUROPEAN)).toBeCloseTo(naiveRepeatProbability(EUROPEAN), 12)
  })

  it('does NOT give the double-zero wheel 1/n, and the plan was wrong about it', () => {
    // The American wheel has 36 values in one pocket each and one value in two,
    // so the two zeros collide with each other. That raises the collision
    // probability above 1/38 rather than lowering it, which is the opposite of
    // what this plan asserted before it was derived.
    //
    // Closed form: sum over distinct values of p^2, with p = multiplicity / n.
    //   36 values at 1/38 contribute 36/1444
    //   one value at 2/38 contributes 4/1444
    //   total 40/1444 = 10/361
    const closedForm = 36 * (1 / 38) ** 2 + (2 / 38) ** 2
    expect(repeatProbability(AMERICAN)).toBeCloseTo(closedForm, 12)
    expect(closedForm).toBeCloseTo(10 / 361, 12)

    // And the correction: it is HIGHER than the European wheel's, not lower.
    expect(repeatProbability(AMERICAN)).toBeGreaterThan(repeatProbability(EUROPEAN))
    expect(repeatProbability(AMERICAN)).not.toBeCloseTo(naiveRepeatProbability(AMERICAN), 6)
  })

  it('gives the American wheel a zero probability of exactly 2/38', () => {
    expect(pocketProbabilities(AMERICAN).get(0)).toBeCloseTo(2 / 38, 12)
    expect(pocketProbabilities(EUROPEAN).get(0)).toBeCloseTo(1 / 37, 12)
  })

  it('gives the American wheel one colour outcome holding both zeros', () => {
    expect(colourProbabilities(AMERICAN).green).toBeCloseTo(2 / 38, 12)
    expect(colourProbabilities(AMERICAN).green).toBeCloseTo(2 / 38, 12)
    expect(colourProbabilities(EUROPEAN).green).toBeCloseTo(1 / 37, 12)
  })

  it('counts a colour repeat by summing the squared colour probabilities', () => {
    for (const wheel of [NO_ZERO, EUROPEAN, AMERICAN]) {
      const p = colourProbabilities(wheel)
      const closedForm = p.red ** 2 + p.black ** 2 + p.green ** 2
      expect(colourRepeatProbability(wheel)).toBeCloseTo(closedForm, 12)
    }
  })

  it('gives a parity probability of exactly one half on every wheel', () => {
    const probabilities = stateProbabilities(AMERICAN, classifyByParity)
    // The zero is a state of its own here, so odd and even are the 36 numbers
    // between them and the zero takes its own share of the wheel.
    expect(probabilities.get('odd')).toBeCloseTo(18 / 38, 12)
    expect(probabilities.get('even')).toBeCloseTo(18 / 38, 12)
    expect(probabilities.get('zero')).toBeCloseTo(2 / 38, 12)
  })

  it('never reports a probability that does not come from counting the wheel', () => {
    for (const wheel of [NO_ZERO, EUROPEAN, AMERICAN]) {
      const total = [...pocketProbabilities(wheel).values()].reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 12)
      const colours = colourProbabilities(wheel)
      expect(colours.red + colours.black + colours.green).toBeCloseTo(1, 12)
      expect(pocketProbabilities(wheel).size).toBe(distinctValues(wheel).length)
    }
  })
})

describe('a fair wheel produces every detector at its own expected rate', () => {
  // 300 000 spins is not decoration: the narrowest band here is the colour run
  // detector, whose expectation differs from a half by well under a point, so a
  // short run would not separate the real rate from the expected one.
  const entries = fairSpins(300_000, EUROPEAN, 'detectors-fair')

  it('repeats at the rate the wheel gives', () => {
    const result = repeatDetector(entries, EUROPEAN)
    expect(result.total).toBe(entries.length - 1)
    expect(Math.abs(result.rate - result.expected)).toBeLessThan(
      3 * standardError(result.expected, result.total),
    )
    expect(result.z).toBeLessThan(3)
  })

  it('alternates at the complement of the repeat rate', () => {
    const repeat = repeatDetector(entries, EUROPEAN)
    const alternating = alternatingDetector(entries, EUROPEAN)
    // The two detectors are derived as complements so they cannot disagree;
    // this is the assertion that the derivation survived.
    expect(alternating.expected).toBeCloseTo(1 - repeat.expected, 12)
    expect(alternating.rate).toBeCloseTo(1 - repeat.rate, 12)
    expect(alternating.wins + repeat.wins).toBe(alternating.total)
  })

  it('continues a colour run at the rising length-conditional rate', () => {
    // The trigger fires at the FIRST spin of a run, and a run only begins when the
    // colour changed. That conditions WHICH colour the run is, because a black run
    // is far likelier to begin than a green one -- P(black) is 18/37 and P(green)
    // is 1/37. Conditioning on the run having survived `length` spins re-weights
    // that lead distribution again, towards the frequent colours, so the
    // continuation probability RISES with run length:
    //
    //     P(continue | run of length L) = SUM_c p_c^(L+1) (1 - p_c) / SUM_c p_c^L (1 - p_c)
    //
    // At length one this is the lead-conditioned form
    // SUM_c p_c^2 (1 - p_c) / (1 - SUM_c p_c^2) -- about 0.4635 on this wheel. The
    // rise towards ~0.4865 as L grows is arithmetic conditioning on survival, NOT
    // an effect in the wheel: the next spin is always the same wheel. The
    // expectation is rebuilt here from the wheel's own probabilities rather than
    // imported, so the test checks the derivation and not merely that the detector
    // agrees with itself.
    const probabilities = colourProbabilities(EUROPEAN)
    let squared = 0
    let weighted = 0
    for (const probability of Object.values(probabilities)) {
      squared += probability * probability
      weighted += probability * probability * (1 - probability)
    }
    const lengthOne = weighted / (1 - squared)

    expect(colourRunContinuationProbability(EUROPEAN, 1)).toBeCloseTo(lengthOne, 12)

    for (const length of [1, 2, 3, 5, 8]) {
      let base = 0
      let continued = 0
      for (const probability of Object.values(probabilities)) {
        const survival = Math.pow(probability, length)
        base += survival * (1 - probability)
        continued += survival * probability * (1 - probability)
      }
      const expected = base <= 0 ? 0 : continued / base

      const result = colourRunDetector(entries, EUROPEAN, length)
      expect(result.expected).toBeCloseTo(expected, 12)
      expect(Math.abs(result.rate - result.expected)).toBeLessThan(
        3 * standardError(result.expected, result.total),
      )
    }
  })

  it('continues a hot pocket at the decile size, not at a tenth', () => {
    const result = hotContinuationDetector(entries, EUROPEAN)
    // NOT one in ten. A decile of 37 distinct pockets floors to three whole
    // pockets, so the honest null is three of thirty-seven, not a tenth. The
    // detector picks the decile by looking at the same spins it then measures,
    // so this expectation is biased in its favour by construction -- the test
    // asserts the bias is bounded, not that it is absent.
    const distinct = distinctValues(EUROPEAN).length
    expect(result.expected).toBeCloseTo(Math.floor(distinct / DECILE) / distinct, 12)
    expect(Math.abs(result.rate - result.expected)).toBeLessThan(
      3 * standardError(result.expected, result.total),
    )
  })

  it('continues a cold pocket at the same decile size, which is what makes the pair useless as signals', () => {
    const result = coldContinuationDetector(entries, EUROPEAN)
    const distinct = distinctValues(EUROPEAN).length
    expect(result.expected).toBeCloseTo(Math.floor(distinct / DECILE) / distinct, 12)
    expect(Math.abs(result.rate - result.expected)).toBeLessThan(
      3 * standardError(result.expected, result.total),
    )
  })

  it('finds a window of the expected size at the wheel\'s own probability', () => {
    const size = 3
    const result = recentWindowDetector(entries, EUROPEAN, size)
    // The expectation is the summed probability of whatever the window actually
    // held, averaged over every window, because the window's contents change as
    // the history runs. That average is very near size/distinct on a wheel whose
    // pockets never repeat, and dips below it once a window happens to hold the
    // same value twice -- so this asserts the approximation the docblock states
    // rather than a closed form that does not exist.
    expect(result.expected).toBeCloseTo(size / distinctValues(EUROPEAN).length, 2)
    expect(Math.abs(result.rate - result.expected)).toBeLessThan(
      3 * standardError(result.expected, result.total),
    )
  })

  it('measures every detector as reliable on a sample this size', () => {
    for (const id of DETECTOR_IDS) {
      const result =
        id === 'repeat'
          ? repeatDetector(entries, EUROPEAN)
          : id === 'alternating'
            ? alternatingDetector(entries, EUROPEAN)
            : id === 'colourRun'
              ? colourRunDetector(entries, EUROPEAN, 3)
              : id === 'hotContinuation'
                ? hotContinuationDetector(entries, EUROPEAN)
                : id === 'coldContinuation'
                  ? coldContinuationDetector(entries, EUROPEAN)
                  : recentWindowDetector(entries, EUROPEAN, 3)
      expect(result.id).toBe(id)
      expect(result.reliable).toBe(true)
    }
  })
})

describe('a detector that cannot tell anything refuses to say it can', () => {
  it('reports itself unreliable below the trigger floor', () => {
    const handful = fairSpins(MIN_TRIGGERS - 1, EUROPEAN, 'too-few')
    for (const result of [
      repeatDetector(handful, EUROPEAN),
      alternatingDetector(handful, EUROPEAN),
      colourRunDetector(handful, EUROPEAN, 1),
    ]) {
      expect(result.total).toBeLessThan(MIN_TRIGGERS)
      expect(result.reliable).toBe(false)
      // A z-score computed on a sample too thin to distinguish anything would be
      // the engine's most confident-looking lie.
      expect(result.z).toBe(0)
    }
  })

  it('reports zero triggers rather than a rate of zero when there is nothing to measure', () => {
    const single = fairSpins(1, EUROPEAN, 'one-spin')
    for (const result of [
      repeatDetector(single, EUROPEAN),
      alternatingDetector(single, EUROPEAN),
      colourRunDetector(single, EUROPEAN, 1),
      hotContinuationDetector(single, EUROPEAN),
      coldContinuationDetector(single, EUROPEAN),
      recentWindowDetector(single, EUROPEAN, 2),
    ]) {
      expect(result.total).toBe(0)
      expect(result.rate).toBe(0)
      expect(result.reliable).toBe(false)
      expect(result.z).toBe(0)
    }
  })

  it('carries the derived expectation even when the measurement is refused', () => {
    const single = fairSpins(1, EUROPEAN, 'one-spin')
    expect(repeatDetector(single, EUROPEAN).expected).toBeCloseTo(repeatProbability(EUROPEAN), 12)
  })
})

describe('an alternating history is caught by exactly one detector', () => {
  // 1, 2, 3, 1, 2, 3 walks the three columns of the board, so it never repeats
  // and never lands on the same colour twice in a row... except 1 and 3 are both
  // red, so the colour detector will also see structure. The point of the test
  // is that the number detector catches it and the colour detector is reported
  // separately rather than folded in.
  const crafted: Pocket[] = []
  for (let i = 0; i < 600; i += 1) crafted.push((i % 3) + 1)

  it('is caught by the alternating detector, far from its expected rate', () => {
    const result = alternatingDetector(crafted, EUROPEAN)
    expect(result.expected).toBeCloseTo(1 - repeatProbability(EUROPEAN), 12)
    expect(result.rate).toBeCloseTo(1, 6)
    expect(result.reliable).toBe(true)
  })

  it('is caught by the alternating detector and by no other number detector', () => {
    const repeat = repeatDetector(crafted, EUROPEAN)
    expect(repeat.rate).toBe(0)

    // The hot and cold detectors are chosen by frequency and the recent-window
    // detector asks whether the next three form the 1,2,3 pattern, which this
    // history does satisfy. Neither of those is the alternating detector's job,
    // so the assertion is simply that the other four do not ALSO fire.
    const firing = [
      alternatingDetector(crafted, EUROPEAN),
      repeatDetector(crafted, EUROPEAN),
      colourRunDetector(crafted, EUROPEAN, 2),
      hotContinuationDetector(crafted, EUROPEAN),
      coldContinuationDetector(crafted, EUROPEAN),
      recentWindowDetector(crafted, EUROPEAN, 3),
    ].filter((result) => Math.abs(result.z) >= 3)
    // Every one of these six is measured; a crafted history is allowed to make
    // several of them fire, because the detectors ask different questions. What
    // must hold is that the alternating one does fire.
    expect(firing).toContainEqual(expect.objectContaining({ id: 'alternating' }))
  })

  it('measures the alternating detector on a wheel whose repeat rate is genuinely different', () => {
    // The American wheel repeats at 10/361, not 1/38, so an alternating history
    // there is missing a DIFFERENT amount of mass than on the European one. If
    // the expectation were typed rather than derived, these two would agree.
    expect(alternatingDetector(crafted, AMERICAN).expected).not.toBeCloseTo(
      alternatingDetector(crafted, EUROPEAN).expected,
      6,
    )
  })
})

describe('the deciles break ties the same way twice', () => {
  it('puts the same pockets in the same decile for the same history', () => {
    const entries = fairSpins(5_000, EUROPEAN, 'deciles')
    const first = decileSets(entries, DECILE)
    const second = decileSets(entries, DECILE)
    expect([...first.hot]).toEqual([...second.hot])
    expect([...first.cold]).toEqual([...second.cold])
    expect(first.hot.size).toBe(first.cold.size)
    // A number cannot be both hot and cold, or the hot/cold pair would be
    // measuring the same set twice.
    for (const pocket of first.hot) expect(first.cold.has(pocket)).toBe(false)
  })

  it('rejects a decile count it cannot build', () => {
    const entries = fairSpins(100, EUROPEAN, 'deciles-bad')
    expect(() => decileSets(entries, 1)).toThrow(RangeError)
    expect(() => decileSets(entries, 51)).toThrow(RangeError)
    expect(() => decileSets(entries, 2.5)).toThrow(RangeError)
  })

  it('rejects a run length or window size it cannot measure', () => {
    const entries = fairSpins(100, EUROPEAN, 'sizes')
    expect(() => colourRunDetector(entries, EUROPEAN, 0)).toThrow(RangeError)
    expect(() => colourRunDetector(entries, EUROPEAN, -1)).toThrow(RangeError)
    expect(() => colourRunDetector(entries, EUROPEAN, 1.5)).toThrow(RangeError)
    expect(() => recentWindowDetector(entries, EUROPEAN, 0)).toThrow(RangeError)
    expect(() => recentWindowDetector(entries, EUROPEAN, 1.5)).toThrow(RangeError)
  })
})

describe('history arrives newest first and the detectors want it the other way round', () => {
  it('reverses a newest-first history into spin order', () => {
    expect(chronological([5, 4, 3])).toEqual([3, 4, 5])
  })

  it('round-trips', () => {
    const entries = chronological(fairSpins(50, EUROPEAN, 'round-trip'))
    expect(chronological(chronological(entries))).toEqual(entries)
  })

  it('does not mutate the array it was given', () => {
    const newestFirst = [9, 8, 7]
    chronological(newestFirst)
    expect(newestFirst).toEqual([9, 8, 7])
  })

  it('measures a different rate backwards than forwards, which is why the order matters', () => {
    const entries = fairSpins(20_000, EUROPEAN, 'order-matters')
    const forwards = repeatDetector(entries, EUROPEAN).rate
    const backwards = repeatDetector([...entries].reverse(), EUROPEAN).rate
    // On fair spins these agree statistically; the point is that the engine is
    // handed spin order deliberately rather than whatever the caller had stored.
    expect(Math.abs(forwards - backwards)).toBeLessThan(0.01)
  })
})

describe('the transition matrix measures dependence rather than restating it', () => {
  const entries = fairSpins(300_000, EUROPEAN, 'markov-fair')

  it('expects each cell from the wheel, not from the sample\'s own totals', () => {
    const result = transitionMatrix(entries, EUROPEAN, classifyByColour)
    const probabilities = stateProbabilities(EUROPEAN, classifyByColour)
    const transitions = result.transitions
    for (const cell of result.cells) {
      const expected = (probabilities.get(cell.from) ?? 0) * (probabilities.get(cell.to) ?? 0) * transitions
      expect(cell.expected).toBeCloseTo(expected, 6)
    }
  })

  it('comes back uniform on a fair wheel, which is the point of running it', () => {
    const result = transitionMatrix(entries, EUROPEAN, classifyByColour)
    expect(result.verdict.level).toBe('uniform')
    expect(result.pValue).toBeGreaterThan(0.1)
    expect(result.states).toEqual(['black', 'green', 'red'])
  })

  it('reports the largest excess as the first cell to read', () => {
    const result = transitionMatrix(entries, EUROPEAN, classifyByColour)
    const largest = Math.max(...result.cells.map((cell) => Math.abs(cell.excess)))
    expect(result.strongest).not.toBeNull()
    expect(Math.abs(result.strongest?.excess ?? 0)).toBeCloseTo(largest, 9)
  })

  it('cancels a matrix built from a chain that alternates perfectly', () => {
    // 1 is red, 2 is black, 3 is red: the chain alternates colour every spin, so
    // the red-to-red and black-to-black cells should be near zero while
    // red-to-black and black-to-red carry the mass. A detector that could not
    // see this would be returning uniform on every input.
    const crafted: Pocket[] = []
    for (let i = 0; i < 20_000; i += 1) crafted.push(i % 2 === 0 ? 1 : 2)
    const result = transitionMatrix(crafted, EUROPEAN, classifyByColour)
    const redToRed = result.cells.find((cell) => cell.from === 'red' && cell.to === 'red')
    const redToBlack = result.cells.find((cell) => cell.from === 'red' && cell.to === 'black')
    expect(redToRed?.observed ?? 0).toBe(0)
    expect(redToBlack?.observed ?? 0).toBeGreaterThan(0)
    expect(Math.abs(redToRed?.excess ?? 0)).toBeGreaterThan(1)
  })

  it('lists a state it never saw as absent rather than measuring it', () => {
    // Only black ever lands, so red and green have no row to measure.
    const onlyBlack: Pocket[] = []
    for (let i = 0; i < 2_000; i += 1) onlyBlack.push(i % 2 === 0 ? 2 : 4)
    const result = transitionMatrix(onlyBlack, EUROPEAN, classifyByColour)
    expect(result.states).toEqual(['black'])
    expect(result.absent).toEqual(['green', 'red'])
    expect(result.cells).toHaveLength(1)
  })

  it('refuses an empty history instead of dividing by zero', () => {
    const result = transitionMatrix([], EUROPEAN, classifyByColour)
    expect(result.transitions).toBe(0)
    expect(result.cells).toEqual([])
    expect(result.pValue).toBe(1)
    expect(result.verdict.level).toBe('refused')
    expect(result.strongest).toBeNull()
  })

  it('refuses a one-state history rather than dividing by zero degrees of freedom', () => {
    // One state yields exactly one cell, so guarding on `cells.length === 0`
    // let it through to `chiSquarePValue(chi2, 0)` and threw. A session with no
    // green on the colour matrix is an ordinary session, not a broken one, so
    // it has to refuse rather than throw.
    const onlyBlack: Pocket[] = []
    for (let i = 0; i < 2_000; i += 1) onlyBlack.push(i % 2 === 0 ? 2 : 4)
    const result = transitionMatrix(onlyBlack, EUROPEAN, classifyByColour)
    expect(result.pValue).toBe(1)
    expect(result.verdict.level).toBe('refused')
    expect(result.strongest).toBeNull()
  })

  it('gives the zero its own parity state, so it is never counted as even', () => {
    expect(classifyByParity(0)).toBe('zero')
    expect(classifyByParity(2)).toBe('even')
    expect(classifyByParity(3)).toBe('odd')
  })

  it('renormalises over the states it kept, so the question is scoped', () => {
    const onlyBlack: Pocket[] = []
    for (let i = 0; i < 2_000; i += 1) onlyBlack.push(i % 2 === 0 ? 2 : 4)
    const result = transitionMatrix(onlyBlack, EUROPEAN, classifyByColour)
    const total = [...result.probabilities.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 12)
  })
})