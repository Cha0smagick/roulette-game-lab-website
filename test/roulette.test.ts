import { describe, expect, it } from 'vitest'
import {
  AMERICAN,
  EUROPEAN,
  NO_ZERO,
  VARIANT_IDS,
  colourOf,
  getWheel,
  isZeroLike,
  pickPocket,
} from '../src/roulette/wheels.js'
import type { VariantId } from '../src/roulette/wheels.js'
import {
  BETS,
  BET_KINDS,
  countCovered,
  covers,
  isZero,
} from '../src/roulette/bets.js'
import type { BetPlacement } from '../src/roulette/bets.js'
import { settle, totalStake } from '../src/roulette/settle.js'
import {
  houseEdge,
  isFairWheel,
  publishedTable,
  representativePlacement,
  returnToPlayer,
  wheelHouseEdge,
  zeroPockets,
} from '../src/roulette/edge.js'
import { EMPTY_HISTORY, pushOutcome, statsFor } from '../src/roulette/history.js'
import { createRng } from '../src/util/rng.js'

describe('wheels', () => {
  it('has the correct pocket count for every variant', () => {
    expect(NO_ZERO.pockets).toHaveLength(36)
    expect(EUROPEAN.pockets).toHaveLength(37)
    expect(AMERICAN.pockets).toHaveLength(38)
  })

  it('contains every pocket exactly once, with no duplicates within a wheel', () => {
    for (const variant of ['noZero', 'european'] as const) {
      const pockets = getWheel(variant).pockets
      expect(new Set(pockets).size, `${variant} has duplicate pockets`).toBe(pockets.length)
    }
    // The American wheel is the exception by design: its double zero repeats
    // the value 0, and that repeat is what produces the higher edge.
    expect(new Set(AMERICAN.pockets).size).toBe(37)
  })

  it('contains no pocket outside the valid range', () => {
    for (const variant of VARIANT_IDS) {
      for (const pocket of getWheel(variant).pockets) {
        expect(Number.isInteger(pocket)).toBe(true)
        expect(pocket).toBeGreaterThanOrEqual(0)
        expect(pocket).toBeLessThanOrEqual(36)
      }
    }
  })

  it('places the double zero eighteen pockets from the single zero', () => {
    // On the printed wheel the two zeros sit opposite each other, nineteen
    // entries apart in the sequence.
    const american = AMERICAN.pockets
    const zeros = american.reduce<number[]>((acc, p, i) => {
      if (p === 0) acc.push(i)
      return acc
    }, [])
    expect(zeros).toHaveLength(2)
    expect(zeros[1]! - zeros[0]!).toBe(19)
  })

  it('paints exactly 18 of 36 numbers red on both real wheels', () => {
    for (const variant of ['european', 'american'] as const) {
      const reds = getWheel(variant).pockets.filter((p) => colourOf(p) === 'red')
      expect(reds).toHaveLength(18)
    }
  })

  it('paints both zeros green on the American wheel', () => {
    expect(colourOf(0)).toBe('green')
    expect(colourOf(0)).toBe('green')
    expect(colourOf(0)).toBe('green')
  })

  it('marks zero-like pockets consistently', () => {
    expect(isZeroLike(0)).toBe(true)
    expect(isZeroLike(1)).toBe(false)
  })

  it('reports which pockets defeat an even-money bet', () => {
    // Only the zeros defeat an even-money bet. On the American wheel that is
    // two pockets of thirty-eight, which is exactly why its edge is 5.26%
    // rather than 2.70%.
    expect(zeroPockets('european')).toEqual([0])
    expect(zeroPockets('american')).toEqual([0, 0])
    expect(zeroPockets('noZero')).toEqual([])
  })

  it('marks zero-like pockets consistently', () => {
    expect(isZeroLike(0)).toBe(true)
    expect(isZeroLike(1)).toBe(false)
  })

  it('picks every pocket at least once over many draws', () => {
    const rng = createRng('wheel-coverage')
    const wheel = getWheel('european')
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i += 1) seen.add(pickPocket(wheel, (max) => rng.int(max)))
    expect(seen.size).toBe(37)
  })
})

describe('bet coverage', () => {
  const european: VariantId = 'european'

  it('covers exactly the published number of pockets', () => {
    for (const kind of BET_KINDS) {
      const placement = representativePlacement(kind, european)
      expect(countCovered(placement, european), `${kind} coverage`).toBe(BETS[kind].covers)
    }
  })

  it('never lets a zero win an outside bet', () => {
    const outside: BetPlacement['kind'][] = ['red', 'black', 'odd', 'even', 'low', 'high']
    for (const kind of outside) {
      expect(covers({ kind }, 0), `${kind} on 0`).toBe(false)
      expect(covers({ kind }, 0), `${kind} on 0`).toBe(false)
      expect(covers({ kind }, 0), `${kind} on 0`).toBe(false)
    }
    expect(covers({ kind: 'odd' }, 0)).toBe(false)
    expect(covers({ kind: 'even' }, 0)).toBe(false)
  })

  it('splits numbers across the three columns with no overlap', () => {
    for (const group of [1, 2, 3]) {
      expect(countCovered({ kind: 'column', group }, european)).toBe(12)
    }
    // Every number 1-36 sits in exactly one column.
    const all = [1, 2, 3].map((group) => countCovered({ kind: 'column', group }, european))
    expect(all.reduce((a, b) => a + b, 0)).toBe(36)
  })

  it('maps columns to the printed layout', () => {
    // Column 1 reads 1, 4, 7, 10; column 3 reads 3, 6, 9, 12.
    expect(covers({ kind: 'column', group: 1 }, 1)).toBe(true)
    expect(covers({ kind: 'column', group: 1 }, 2)).toBe(false)
    expect(covers({ kind: 'column', group: 3 }, 12)).toBe(true)
  })

  it('splits the dozens into three groups of twelve', () => {
    for (const group of [1, 2, 3]) {
      expect(countCovered({ kind: 'dozen', group }, european)).toBe(12)
    }
    expect(covers({ kind: 'dozen', group: 1 }, 12)).toBe(true)
    expect(covers({ kind: 'dozen', group: 1 }, 13)).toBe(false)
    expect(covers({ kind: 'dozen', group: 3 }, 36)).toBe(true)
  })

  it('splits low and high at eighteen', () => {
    expect(covers({ kind: 'low' }, 18)).toBe(true)
    expect(covers({ kind: 'low' }, 19)).toBe(false)
    expect(covers({ kind: 'high' }, 19)).toBe(true)
    expect(covers({ kind: 'high' }, 18)).toBe(false)
    expect(countCovered({ kind: 'low' }, european)).toBe(18)
    expect(countCovered({ kind: 'high' }, european)).toBe(18)
  })

  it('splits odd and even into eighteen each, excluding zero', () => {
    expect(countCovered({ kind: 'odd' }, european)).toBe(18)
    expect(countCovered({ kind: 'even' }, european)).toBe(18)
    expect(covers({ kind: 'odd' }, 3)).toBe(true)
    expect(covers({ kind: 'even' }, 4)).toBe(true)
  })

  it('splits red and black into eighteen each on every wheel', () => {
    for (const variant of VARIANT_IDS) {
      expect(countCovered({ kind: 'red' }, variant), `red on ${variant}`).toBe(18)
      expect(countCovered({ kind: 'black' }, variant), `black on ${variant}`).toBe(18)
    }
  })

  it('never covers five pockets with a corner bet', () => {
    expect(countCovered({ kind: 'corner', numbers: [17, 18, 20, 21] }, european)).toBe(4)
    expect(countCovered({ kind: 'corner', numbers: [1, 2, 3, 4] }, european)).toBe(4)
  })

  it('covers exactly six pockets with a six line bet', () => {
    expect(countCovered({ kind: 'line', numbers: [1, 2, 3, 4, 5, 6] }, european)).toBe(6)
  })

  it('marks a single zero as the only value that defeats an outside bet', () => {
    expect(isZero(0)).toBe(true)
    expect(isZero(1)).toBe(false)
    expect(isZero(36)).toBe(false)
  })

  it('counts pockets rather than distinct values on the American wheel', () => {
    // 38 pockets but 37 distinct values: the double zero shares the value 0.
    expect(AMERICAN.pockets).toHaveLength(38)
    expect(new Set(AMERICAN.pockets).size).toBe(37)
  })
})

describe('house edge', () => {
  it('derives the textbook edges to four decimal places', () => {
    expect(wheelHouseEdge('noZero')).toBeCloseTo(0, 10)
    expect(wheelHouseEdge('european')).toBeCloseTo(0.0270, 4)
    expect(wheelHouseEdge('american')).toBeCloseTo(0.0526, 4)
  })

  it('gives every bet on a wheel the same edge', () => {
    // This identity is the reason the casino's advantage is a property of the
    // wheel rather than of any particular bet. If it ever fails, one of the
    // published payouts is wrong.
    for (const variant of VARIANT_IDS) {
      const target = wheelHouseEdge(variant)
      for (const kind of BET_KINDS) {
        expect(houseEdge(kind, variant), `${kind} on ${variant}`).toBeCloseTo(target, 10)
      }
    }
  })

  it('reports zero edge only on the no-zero wheel', () => {
    expect(isFairWheel('noZero')).toBe(true)
    expect(isFairWheel('european')).toBe(false)
    expect(isFairWheel('american')).toBe(false)
  })

  it('derives return to player as one minus the edge', () => {
    expect(returnToPlayer('european')).toBeCloseTo(0.9730, 4)
    expect(returnToPlayer('american')).toBeCloseTo(0.9474, 4)
    expect(returnToPlayer('noZero')).toBeCloseTo(1, 10)
  })

  it('publishes a table that matches the measured coverage', () => {
    for (const row of publishedTable('european')) {
      expect(countCovered(representativePlacement(row.kind, 'european'), 'european')).toBe(
        row.covers,
      )
      expect(row.edge).toBeCloseTo(0.027, 4)
    }
  })

it('measures a straight-up on an ordinary number, never on a zero', () => {
    // Documented limitation: on the American wheel the value 0 fills two
    // pockets, and a value-based predicate cannot tell them apart. Measuring
    // that would report an absurd +89% edge, so the representative pocket is
    // an ordinary number and the published 5.26% is the real one.
    const straight = representativePlacement('straight', 'american')
    expect(straight.numbers).toEqual([17])
    expect(countCovered(straight, 'american')).toBe(1)
    expect(houseEdge('straight', 'american')).toBeCloseTo(0.0526, 4)
  })
})

describe('settlement', () => {

  it('pays a straight-up at exactly 35 to 1 plus the stake', () => {
    const result = settle([{ id: 'a', placement: { kind: 'straight', numbers: [17] }, stake: 1 }], 17)
    expect(result.returned).toBe(36)
    expect(result.net).toBe(35)
    expect(result.winners).toHaveLength(1)
  })

  it('scales payouts linearly with the stake', () => {
    const result = settle([{ id: 'a', placement: { kind: 'straight', numbers: [17] }, stake: 5 }], 17)
    expect(result.returned).toBe(180)
    expect(result.net).toBe(175)
  })

  it('returns nothing for a losing bet', () => {
    const result = settle([{ id: 'a', placement: { kind: 'straight', numbers: [17] }, stake: 10 }], 18)
    expect(result.returned).toBe(0)
    expect(result.net).toBe(-10)
    expect(result.winners).toHaveLength(0)
  })

  it('never pushes, even on an uncovered number', () => {
    const result = settle([{ id: 'a', placement: { kind: 'straight', numbers: [0] }, stake: 3 }], 5)
    expect(result.net).toBe(-3)
  })

  it('sums multiple bets on one spin', () => {
    const bets = [
      { id: 'red', placement: { kind: 'red' } as BetPlacement, stake: 10 },
      { id: 'even', placement: { kind: 'even' } as BetPlacement, stake: 5 },
      { id: 'seventeen', placement: { kind: 'straight', numbers: [17] } as BetPlacement, stake: 1 },
    ]
    // 18 is a red even number, so red and even both win and the straight-up
    // on 17 loses.
    const result = settle(bets, 18)
    expect(result.wagered).toBe(16)
    expect(result.returned).toBe(30)
    expect(result.net).toBe(14)
    expect(result.winners.map((w) => w.id)).toEqual(['red', 'even'])
  })

  it('totals the felt', () => {
    const bets = [
      { id: 'a', placement: { kind: 'red' } as BetPlacement, stake: 1 },
      { id: 'b', placement: { kind: 'black' } as BetPlacement, stake: 2 },
    ]
    expect(totalStake(bets)).toBe(3)
    expect(totalStake([])).toBe(0)
  })

  it('loses the zero on every outside bet', () => {
    const bets = [
      { id: 'red', placement: { kind: 'red' } as BetPlacement, stake: 1 },
      { id: 'low', placement: { kind: 'low' } as BetPlacement, stake: 1 },
      { id: 'even', placement: { kind: 'even' } as BetPlacement, stake: 1 },
    ]
    const result = settle(bets, 0)
    expect(result.returned).toBe(0)
    expect(result.net).toBe(-3)
  })
})

describe('history', () => {
  const isRed = (pocket: number): boolean =>
    pocket > 0 && colourOf(pocket) === 'red'

  it('keeps the most recent outcome first', () => {
    let history = EMPTY_HISTORY
    history = pushOutcome(history, 17)
    history = pushOutcome(history, 5)
    expect(history.entries).toEqual([5, 17])
  })

  it('caps the stored history', () => {
    let history = EMPTY_HISTORY
    for (let i = 0; i < 250; i += 1) history = pushOutcome(history, i % 37)
    expect(history.entries.length).toBeLessThanOrEqual(100)
  })

it('reports a streak of repeated pockets', () => {
    // History keeps the most recent first, so the repeated pockets are pushed
    // last in order to become the head of the list.
    let history = EMPTY_HISTORY
    for (const pocket of [5, 17, 17, 17]) history = pushOutcome(history, pocket)
    expect(history.entries).toEqual([17, 17, 17, 5])
    expect(statsFor(history, isRed).streak).toEqual({ pocket: 17, length: 3 })
  })

it('reports no streak when the last outcomes differ', () => {
    let history = EMPTY_HISTORY
    history = pushOutcome(history, 17)
    history = pushOutcome(history, 5)
    expect(statsFor(history, isRed).streak).toBeNull()
  })

it('tracks the leading run of one colour', () => {
    // 3, 5, 7 are red; the run starts at the head and stops where black begins.
    let history = EMPTY_HISTORY
    for (const pocket of [2, 7, 5, 3]) history = pushOutcome(history, pocket)
    expect(statsFor(history, isRed).colourRun).toEqual({ colour: 'red', length: 3 })
  })

it('stops a colour run at a zero', () => {
    // The zero is the most recent spin, so there is no colour run to report.
    let history = EMPTY_HISTORY
    for (const pocket of [3, 5, 0]) history = pushOutcome(history, pocket)
    expect(statsFor(history, isRed).colourRun).toBeNull()
  })
})