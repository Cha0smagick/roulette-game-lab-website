import { createRng } from '../util/rng.js'
import { settleOne } from '../roulette/settle.js'
import { getWheel, pickPocket } from '../roulette/wheels.js'
import type { VariantId } from '../roulette/wheels.js'
import { STRATEGIES, initialRun } from './strategies.js'
import type { StrategyId, StrategyRun } from './strategies.js'

/**
 * Batch simulation.
 *
 * Everything reported here is measured, not asserted. Expected value, return,
 * drawdown and ruin are read off a run that actually happened, and the seed is
 * printed so a reader can replay it. A tool that asserted a conclusion instead
 * of measuring it would be an argument, not an engine.
 *
 * Allocation: the inner loop deliberately does not allocate anything that grows
 * with the spin count. It calls `settleOne` rather than `settle`, so no bet
 * array, no settlement and no winner array is built per spin; the equity series
 * is sampled down to `samples` points as it goes; and the sample schedule is
 * an `Int32Array` walked with a single pointer, so the per-spin cost is one
 * integer comparison. The strategy functions themselves still return a small
 * plan object and a new run object per spin, which is the price of making them
 * pure and testable. That is affordable because this runs in a Worker.
 */

/** Hard ceiling on retained equity points, so a chart can never be the memory. */
export const EQUITY_SAMPLE_CAP = 240

export interface RunRequest {
  readonly strategy: StrategyId
  readonly variant: VariantId
  readonly spins: number
  readonly bankroll: number
  readonly minBet: number
  readonly maxBet: number
  readonly seed: string
  /** Points to retain from the equity curve. Clamped to EQUITY_SAMPLE_CAP. */
  readonly samples: number
}

export interface RunResult {
  readonly strategy: StrategyId
  readonly variant: VariantId
  /** Spins requested. */
  readonly spins: number
  /** Spins actually played before ruin, or before the requested count. */
  readonly spinsPlayed: number
  readonly finalBankroll: number
  readonly wagered: number
  /** Net per spin played. Zero when nothing was played. */
  readonly evPerSpin: number
  /** Net over the starting bankroll, as a fraction. */
  readonly roi: number
  /** Largest peak-to-trough fall in the bankroll, in currency. */
  readonly maxDrawdown: number
  readonly busted: boolean
  /** The spin that ruined the player, or null. */
  readonly bustSpin: number | null
  /** Downsampled bankroll curve, first point is the starting bankroll. */
  readonly equity: readonly number[]
  /** True when the curve was sampled down from more points than were kept. */
  readonly truncated: boolean
}

/**
 * One seeded round for one system.
 *
 * The seed is suffixed with the strategy id so that eight systems on the same
 * wheel get eight independent streams. Sharing one stream would make the
 * comparison fair in a way nobody asked for and would couple the results: a
 * change to one system's spin count would move every other system's numbers.
 */
export function runOne(request: RunRequest): RunResult {
  if (!Number.isSafeInteger(request.spins) || request.spins < 0) {
    throw new RangeError('spins must be a non-negative safe integer')
  }
  const samples = Math.min(EQUITY_SAMPLE_CAP, Math.max(2, request.samples))
  const wheel = getWheel(request.variant)
  const rng = createRng(`${request.seed}:${request.strategy}`)
  const strategy = STRATEGIES[request.strategy]

  let run: StrategyRun = initialRun({
    bankroll: request.bankroll,
    minBet: request.minBet,
    maxBet: request.maxBet,
  })

  const sampleAt = new Int32Array(samples)
  const span = Math.max(1, samples - 1)
  const spinSpan = Math.max(0, request.spins - 1)
  for (let k = 0; k < samples; k += 1) {
    sampleAt[k] = Math.round((k * spinSpan) / span)
  }
  const equity: number[] = []
  let sampleCursor = 0

  let peak = request.bankroll
  let maxDrawdown = 0
  let busted = false
  let bustSpin: number | null = null
  let spinsPlayed = 0

  for (let i = 0; i < request.spins; i += 1) {
    const plan = strategy.plan(run, request.variant)

    // Ruin is declared when the bet the system asks for exceeds the bankroll.
    // The system is not allowed to quietly shrink the bet to something
    // affordable, because that is the decision a real player has to make and
    // it is the decision these systems are supposed to fail at.
    if (plan.stake > run.bankroll) {
      busted = true
      bustSpin = i
      break
    }

    const pocket = pickPocket(wheel, (max) => rng.int(max))
    const result = settleOne(plan.placement, plan.stake, pocket)

    run = {
      ...strategy.advance(run, result.won),
      bankroll: run.bankroll + result.net,
      wagered: run.wagered + plan.stake,
      spins: run.spins + 1,
    }
    spinsPlayed += 1

    if (run.bankroll > peak) peak = run.bankroll
    const drawdown = peak - run.bankroll
    if (drawdown > maxDrawdown) maxDrawdown = drawdown

    if (sampleCursor < samples && i === sampleAt[sampleCursor]) {
      equity.push(run.bankroll)
      sampleCursor += 1
    }
  }

  // Always close the curve on the true final bankroll. Without this the last
  // charted point is an interpolated sample and the visible end of the line is
  // not the number printed next to it.
  if (equity.length === 0 || equity[equity.length - 1] !== run.bankroll) {
    equity.push(run.bankroll)
  }

  const net = run.bankroll - request.bankroll
  return {
    strategy: request.strategy,
    variant: request.variant,
    spins: request.spins,
    spinsPlayed,
    finalBankroll: run.bankroll,
    wagered: run.wagered,
    evPerSpin: spinsPlayed === 0 ? 0 : net / spinsPlayed,
    roi: request.bankroll === 0 ? 0 : net / request.bankroll,
    maxDrawdown,
    busted,
    bustSpin,
    equity,
    truncated: spinsPlayed > equity.length,
  }
}

export interface BatchRequest {
  readonly variant: VariantId
  readonly spins: number
  readonly bankroll: number
  readonly minBet: number
  readonly maxBet: number
  readonly seed: string
  readonly samples: number
  readonly strategies: readonly StrategyId[]
}

/**
 * Run several systems over the same settings.
 *
 * Each gets its own stream, so the numbers are independently reproducible and
 * comparing them compares the systems rather than the luck of the draw order.
 */
export function runBatch(batch: BatchRequest): RunResult[] {
  const out: RunResult[] = []
  for (const strategy of batch.strategies) {
    out.push(
      runOne({
        strategy,
        variant: batch.variant,
        spins: batch.spins,
        bankroll: batch.bankroll,
        minBet: batch.minBet,
        maxBet: batch.maxBet,
        seed: batch.seed,
        samples: batch.samples,
      }),
    )
  }
  return out
}