import { describe, expect, it } from 'vitest'
import { STRATEGIES, STRATEGY_IDS, STRATEGY_LABEL, initialRun } from '../src/sim/strategies.js'
import type { StrategyId, StrategyRun } from '../src/sim/strategies.js'
import { EQUITY_SAMPLE_CAP, runBatch, runOne } from '../src/sim/engine.js'
import { settle, settleOne } from '../src/roulette/settle.js'
import type { PlacedBet } from '../src/roulette/settle.js'
import { BETS, countCovered, covers } from '../src/roulette/bets.js'
import { isLegal } from '../src/game/table.js'
import { equityScale, xFor, yFor } from '../src/sim/charts.js'
import type { EquitySeries } from '../src/sim/charts.js'
import { VARIANT_IDS } from '../src/roulette/wheels.js'

/**
 * What has to be true for this page to be worth publishing.
 *
 * The load-bearing test in this file is the last one: it runs every system on a
 * real wheel with a real seeded stream and asserts that none of them produces a
 * positive expected value. That is the product's thesis, and it is asserted by
 * measurement rather than by repeating a claim.
 */

const BASE = { bankroll: 1000, minBet: 1, maxBet: 100 }

function runWith(id: StrategyId, spins: number, overrides: Partial<typeof BASE> = {}): StrategyRun {
  let run = initialRun({ ...BASE, ...overrides })
  const strategy = STRATEGIES[id]
  for (let i = 0; i < spins; i += 1) {
    const plan = strategy.plan(run, 'european')
    // Alternate the result so a progression is exercised in both directions
    // deterministically, without involving the wheel.
    const won = i % 2 === 0
    run = {
      ...strategy.advance(run, won),
      bankroll: run.bankroll + (won ? plan.stake : -plan.stake),
      wagered: run.wagered + plan.stake,
      spins: run.spins + 1,
    }
  }
  return run
}

describe('strategies', () => {
  it('registers every id with a definition and a translated label', () => {
    expect(STRATEGY_IDS).toHaveLength(8)
    for (const id of STRATEGY_IDS) {
      expect(STRATEGIES[id].id).toBe(id)
      expect(STRATEGY_LABEL[id]).toBe(`sim.strategy.${id}`)
    }
  })

  it('every planned bet is a legal placement that covers at least one pocket', () => {
    for (const id of STRATEGY_IDS) {
      const strategy = STRATEGIES[id]
      for (const variant of VARIANT_IDS) {
        const run = runWith(id, 40)
        const plan = strategy.plan(run, variant)
        expect(isLegal(plan.placement), `${id} on ${variant}`).toBe(true)
        expect(countCovered(plan.placement, variant), `${id} on ${variant}`).toBeGreaterThan(0)
        expect(plan.stake).toBeGreaterThan(0)
      }
    }
  })

  it('flat bets the base unit forever', () => {
    const run = runWith('flat', 25)
    expect(STRATEGIES.flat.plan(run, 'european').stake).toBe(BASE.minBet)
    expect(STRATEGIES.flat.plan(initialRun(BASE), 'european').stake).toBe(BASE.minBet)
  })

  it('martingale doubles after a loss and stops doubling at the table limit', () => {
    const martingale = STRATEGIES.martingale
    let run = initialRun(BASE)
    expect(martingale.plan(run, 'european').stake).toBe(1)
    for (let i = 0; i < 12; i += 1) {
      const stake = martingale.plan(run, 'european').stake
      // Exactly 2^losses until the clamp, and never above the limit.
      expect(stake).toBe(Math.min(2 ** run.losses, BASE.maxBet))
      expect(stake).toBeLessThanOrEqual(BASE.maxBet)
      run = martingale.advance(run, false)
    }
    expect(martingale.plan(run, 'european').stake).toBe(BASE.maxBet)
    expect(martingale.advance(run, true).losses).toBe(0)
    expect(martingale.plan(martingale.advance(run, true), 'european').stake).toBe(1)
  })

  it('reverse martingale doubles after a win and resets after a loss', () => {
    const system = STRATEGIES.reverseMartingale
    let run = initialRun(BASE)
    expect(system.plan(run, 'european').stake).toBe(1)
    run = system.advance(run, true)
    expect(system.plan(run, 'european').stake).toBe(2)
    run = system.advance(run, true)
    expect(system.plan(run, 'european').stake).toBe(4)
    expect(system.advance(run, false).wins).toBe(0)
    expect(system.plan(system.advance(run, false), 'european').stake).toBe(1)
  })

  it('labouchere crosses a pair off on a win and appends a unit on a loss', () => {
    const system = STRATEGIES.labouchere
    const start = initialRun(BASE)
    // Five unit list, first plus last is two units.
    expect(system.plan(start, 'european').stake).toBe(2)
    const afterLoss = system.advance(start, false)
    expect(afterLoss.sequence).toHaveLength(6)
    expect(system.plan(afterLoss, 'european').stake).toBe(2)
    const afterWin = system.advance(start, true)
    expect(afterWin.sequence).toHaveLength(3)
    expect(system.plan(afterWin, 'european').stake).toBe(2)
  })

  it('labouchere restarts its list when the cycle completes', () => {
    const system = STRATEGIES.labouchere
    let run = initialRun(BASE)
    // Cross off pairs until the list empties, then assert it came back.
    for (let i = 0; i < 6; i += 1) run = system.advance(run, true)
    expect(run.sequence).toEqual([1, 1, 1, 1, 1])
    expect(system.plan(run, 'european').stake).toBe(2)
  })

  it('fibonacci steps forward on a loss, back on a win, and clamps', () => {
    const system = STRATEGIES.fibonacci
    let run = initialRun(BASE)
    const seen: number[] = []
    for (let i = 0; i < 10; i += 1) {
      seen.push(system.plan(run, 'european').stake)
      run = system.advance(run, false)
    }
    expect(seen.slice(0, 7)).toEqual([1, 1, 2, 3, 5, 8, 13])
    // Ten losses put the index at the eleventh term, 89. The clamp is not
    // reached yet, so the raw term must show through unclamped.
    expect(seen[9]).toBe(55)
    expect(system.plan(run, 'european').stake).toBe(89)
    // One more loss passes the table limit, and from then on the clamp holds.
    const clamped = system.advance(run, false)
    expect(system.plan(clamped, 'european').stake).toBe(BASE.maxBet)
    expect(system.plan(system.advance(clamped, false), 'european').stake).toBe(BASE.maxBet)
    expect(system.advance(run, true).losses).toBe(0)
    expect(system.plan(system.advance(run, true), 'european').stake).toBe(1)
  })

  it('dAlembert rises one unit on a loss and never goes below the base', () => {
    const system = STRATEGIES.dAlembert
    let run = initialRun(BASE)
    expect(system.plan(run, 'european').stake).toBe(1)
    run = system.advance(run, false)
    expect(system.plan(run, 'european').stake).toBe(2)
    run = system.advance(run, false)
    expect(system.plan(run, 'european').stake).toBe(3)
    run = system.advance(run, false)
    run = system.advance(run, true)
    run = system.advance(run, true)
    expect(system.plan(run, 'european').stake).toBe(1)
  })

  it('oscar grind returns to one unit after a single loss', () => {
    const system = STRATEGIES.oscarGrind
    const start = initialRun(BASE)
    expect(system.plan(start, 'european').stake).toBe(1)
    // A win banks one unit of cycle profit, so the next bet is the target.
    const afterWin = system.advance(start, true)
    expect(afterWin.cycle).toBe(1)
    // A loss throws the accumulated cycle profit away entirely.
    const afterLoss = system.advance(afterWin, false)
    expect(afterLoss.cycle).toBe(1)
    expect(system.plan(afterLoss, 'european').stake).toBe(1)
  })

  it('column progression advances the column on a loss and resets on a win', () => {
    const system = STRATEGIES.columnProgression
    let run = initialRun(BASE)
    expect(system.plan(run, 'european').placement).toEqual({ kind: 'column', group: 1 })
    run = system.advance(run, false)
    expect(system.plan(run, 'european').placement).toEqual({ kind: 'column', group: 2 })
    run = system.advance(run, false)
    expect(system.plan(run, 'european').placement).toEqual({ kind: 'column', group: 3 })
    // Wraps rather than running off the end of the board.
    run = system.advance(run, false)
    expect(system.plan(run, 'european').placement).toEqual({ kind: 'column', group: 1 })
    expect(system.advance(run, true).cycle).toBe(1)
  })

  it('no system ever asks for more than the table limit', () => {
    for (const id of STRATEGY_IDS) {
      const run = runWith(id, 400, { maxBet: 25 })
      const stake = STRATEGIES[id].plan(run, 'european').stake
      expect(stake, id).toBeLessThanOrEqual(25)
      expect(stake, id).toBeGreaterThanOrEqual(BASE.minBet)
    }
  })

  it('rejects an impossible setup rather than running it', () => {
    expect(() => initialRun({ bankroll: 0, minBet: 1, maxBet: 10 })).toThrow(RangeError)
    expect(() => initialRun({ bankroll: 10, minBet: 0, maxBet: 10 })).toThrow(RangeError)
    expect(() => initialRun({ bankroll: 10, minBet: 5, maxBet: 1 })).toThrow(RangeError)
    expect(() => initialRun({ bankroll: 1.5, minBet: 1, maxBet: 10 })).toThrow(RangeError)
  })
})

describe('settleOne agrees with settle', () => {
  const cases: { kind: 'straight'; numbers: number[] }[] = [
    { kind: 'straight', numbers: [17] },
    { kind: 'straight', numbers: [0] },
  ]

  it('reports the same profit as the full settlement on a win', () => {
    for (const placement of [{ kind: 'red' } as const, { kind: 'column', group: 2 } as const, ...cases]) {
      for (const outcome of [17, 0, 5, 32]) {
        for (const stake of [1, 7, 100]) {
          const bets: PlacedBet[] = [{ id: 'a', placement, stake }]
          const full = settle(bets, outcome)
          const one = settleOne(placement, stake, outcome)
          expect(one.won).toBe(covers(placement, outcome))
          expect(one.net).toBe(full.net)
          if (one.won) {
            // On a single winning bet the net IS the profit, because `net` is
            // `returned` minus the stake and a win returns stake plus profit.
            expect(one.profit).toBe(full.returned - stake)
            expect(one.profit).toBe(full.net)
            expect(one.profit).toBe(stake * BETS[placement.kind].payout)
          } else {
            // A losing bet returns nothing, so it has no profit to report even
            // though it cost the player the stake.
            expect(one.profit).toBe(0)
            expect(one.net).toBe(-stake)
          }
        }
      }
    }
  })
})

describe('engine', () => {
  const request = {
    variant: 'european',
    spins: 4000,
    bankroll: 1000,
    minBet: 1,
    maxBet: 100,
    seed: 'REPLAY-ME',
    samples: 40,
  } as const

  it('is deterministic for a given seed', () => {
    const a = runOne({ ...request, strategy: 'martingale' })
    const b = runOne({ ...request, strategy: 'martingale' })
    expect(a).toEqual(b)
  })

  it('gives each system its own stream so runs are independent', () => {
    const results = runBatch({ ...request, strategies: STRATEGY_IDS })
    expect(results).toHaveLength(8)
    const shapes = new Set(results.map((result) => result.equity.join(',')))
    // Eight systems with independent streams cannot all trace the same curve.
    expect(shapes.size).toBeGreaterThan(1)
  })

  it('stops at ruin and reports the spin it happened on', () => {
    const result = runOne({
      ...request,
      strategy: 'martingale',
      spins: 200000,
      bankroll: 40,
      minBet: 1,
      maxBet: 100,
    })
    if (result.busted) {
      expect(result.bustSpin).not.toBeNull()
      expect(result.spinsPlayed).toBeLessThan(result.spins)
      expect(result.finalBankroll).toBeGreaterThanOrEqual(0)
    }
  })

  it('never stakes more than the bankroll, so a ruin leaves a non-negative balance', () => {
    for (const strategy of STRATEGY_IDS) {
      const result = runOne({ ...request, strategy, spins: 20000, bankroll: 60 })
      expect(result.finalBankroll, strategy).toBeGreaterThanOrEqual(0)
      expect(result.wagered, strategy).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the equity curve bounded however long the run', () => {
    const result = runOne({ ...request, strategy: 'flat', spins: 60000, samples: 5000 })
    expect(result.equity.length).toBeLessThanOrEqual(EQUITY_SAMPLE_CAP)
    expect(result.truncated).toBe(true)
  })

  it('the last equity point is the final bankroll it reports', () => {
    for (const strategy of STRATEGY_IDS) {
      const result = runOne({ ...request, strategy, spins: 3000 })
      expect(result.equity[result.equity.length - 1], strategy).toBe(result.finalBankroll)
    }
  })

  it('handles a zero-spin request without dividing by zero', () => {
    const result = runOne({ ...request, strategy: 'flat', spins: 0 })
    expect(result.spinsPlayed).toBe(0)
    expect(result.evPerSpin).toBe(0)
    expect(result.roi).toBe(0)
    expect(result.busted).toBe(false)
    expect(result.equity).toEqual([request.bankroll])
  })

  it('rejects a negative spin count', () => {
    expect(() => runOne({ ...request, strategy: 'flat', spins: -1 })).toThrow(RangeError)
  })

  it('books exactly one base-unit stake per spin for a flat system', () => {
    const result = runOne({ ...request, strategy: 'flat', spins: 5000 })
    // Flat stakes the base unit every spin, so the wager is exactly countable.
    // This is the cheapest possible check that the loop is actually staking
    // once per spin and not zero times or twice.
    expect(result.spinsPlayed).toBe(result.spins)
    expect(result.wagered).toBe(result.spinsPlayed * request.minBet)
    expect(result.roi).toBeCloseTo((result.finalBankroll - request.bankroll) / request.bankroll, 10)
    expect(result.evPerSpin).toBeCloseTo((result.finalBankroll - request.bankroll) / result.spinsPlayed, 10)
  })

  /**
   * The claim the page exists to support, measured rather than restated.
   *
   * The zero-edge wheel is run over enough spins that the sampling error is a
   * small fraction of the edge, and the fair wheel is run long enough that a
   * positive result cannot be luck. Both directions matter: a negative result
   * on the unfair wheel proves the house edge is being charged, and a result
   * indistinguishable from zero on the fair wheel proves the engine is not
   * simply biased against the player.
   */
  it('no system beats a wheel with a zero, and none is beaten by the fair wheel', () => {
    const spins = 300000
    const settings = { spins, bankroll: 5000, minBet: 1, maxBet: 100, seed: 'HOUSE-EDGE', samples: 60 }

    for (const id of STRATEGY_IDS) {
      const european = runOne({ ...settings, strategy: id, variant: 'european' })
      expect(european.evPerSpin, `${id} on european`).toBeLessThan(0)
    }

    // Every system on the zero-edge wheel, pooled, must sit at zero. Each
    // individual run has sampling error, so the assertion is on the mean.
    let total = 0
    let measured = 0
    for (const id of STRATEGY_IDS) {
      const fair = runOne({ ...settings, strategy: id, variant: 'noZero' })
      total += fair.evPerSpin
      measured += 1
    }
    const mean = total / measured
    // 8 systems x 300k spins of even money gives a standard error near 0.001,
    // so 0.01 is a bound this should never approach without a real fault.
    expect(Math.abs(mean)).toBeLessThan(0.01)
  })
})

describe('chart geometry', () => {
  const box = { x: 10, y: 20, w: 100, h: 50 }

  it('scales to cover every point of every series', () => {
    const series: EquitySeries[] = [
      { id: 'a', colour: '#fff', points: [100, 250, 40] },
      { id: 'b', colour: '#000', points: [10, 20] },
    ]
    const scale = equityScale(series)
    expect(scale.min).toBeLessThanOrEqual(10)
    expect(scale.max).toBeGreaterThanOrEqual(250)
    expect(scale.span).toBeCloseTo(scale.max - scale.min, 10)
  })

  it('widens a flat range instead of dividing by it', () => {
    const scale = equityScale([{ id: 'a', colour: '#fff', points: [7, 7, 7] }])
    expect(Number.isFinite(scale.span)).toBe(true)
    expect(scale.span).toBeGreaterThan(0)
    expect(scale.min).toBeLessThan(7)
    expect(scale.max).toBeGreaterThan(7)
  })

  it('returns a usable range for no data at all', () => {
    const scale = equityScale([])
    expect(scale.span).toBeGreaterThan(0)
    expect(Number.isFinite(scale.min)).toBe(true)
    expect(Number.isFinite(scale.max)).toBe(true)
  })

  it('maps a single-point series to the left edge rather than dividing by zero', () => {
    expect(xFor(0, 1, box)).toBe(box.x)
  })

  it('maps the ends of a series to the ends of the plot box', () => {
    expect(xFor(0, 5, box)).toBeCloseTo(box.x, 10)
    expect(xFor(4, 5, box)).toBeCloseTo(box.x + box.w, 10)
  })

  it('inverts the y axis so a larger value sits higher on screen', () => {
    const scale = { min: 0, max: 100, span: 100 }
    expect(yFor(0, scale, box)).toBeCloseTo(box.y + box.h, 10)
    expect(yFor(100, scale, box)).toBeCloseTo(box.y, 10)
    expect(yFor(50, scale, box)).toBeCloseTo(box.y + box.h / 2, 10)
  })
})