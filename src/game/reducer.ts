import type { Bet, JackpotState, SpinOutcome } from './types';
import type { Rng } from '../util/rng';
import { createRng } from '../util/rng';
import { JACKPOT } from './paytable';
import { resolveSpin, spinSeed } from './spin';

/**
 * Session state and reducer.
 *
 * The reducer is the only place state changes, and every change is an explicit
 * action -> state function. That is what lets a session be reconstructed from
 * its action log, which is the same discipline the seeded RNG uses.
 */

export interface SessionState {
  /** Public seed. Shown to the player so any spin can be audited. */
  seed: string;
  rng: Rng;
  /** Energy available to spend. Only ever increased by cadence.ts. */
  energy: number;
  /** Spendable credits. */
  credits: number;
  /** Number of spins resolved in this session. */
  spinIndex: number;
  /** Consecutive winning spins. Resets on any loss, including near-misses. */
  streak: number;
  /** Best streak ever reached in this session. */
  bestStreak: number;
  bet: Bet;
  jackpot: JackpotState;
  lastOutcome: SpinOutcome | null;
}

export type SessionAction =
  | { readonly type: 'spin' }
  | { readonly type: 'grant-energy'; readonly amount: number }
  | { readonly type: 'set-bet'; readonly bet: Bet }
  | { readonly type: 'reset' };

export const STARTING_ENERGY = 6;
export const STARTING_CREDITS = 100;

export function createSession(seed: string, energy = STARTING_ENERGY): SessionState {
  return {
    seed,
    rng: createRng(seed),
    energy,
    credits: STARTING_CREDITS,
    spinIndex: 0,
    streak: 0,
    bestStreak: 0,
    bet: 1,
    jackpot: { amount: JACKPOT.seed, cap: JACKPOT.cap },
    lastOutcome: null,
  };
}

export function canSpin(state: SessionState): boolean {
  return state.energy >= state.bet && state.credits >= state.bet;
}

/**
 * Pure transition. Returns a new state; never mutates the input.
 *
 * A spin that cannot be afforded is a no-op rather than an error: the UI can
 * double-tap and the reducer simply ignores the second tap instead of throwing
 * into an unhandled rejection.
 */
export function reduce(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'spin': {
      if (!canSpin(state)) {
        return state;
      }
      const index = state.spinIndex + 1;
      const outcome = resolveSpin(state.rng, state.bet, spinSeed(state.seed, index));
      const won = outcome.payoutMultiplier > 0;

      return {
        ...state,
        rng: state.rng,
        energy: state.energy - state.bet,
        credits: state.credits - state.bet + outcome.payoutMultiplier,
        spinIndex: index,
        // A near-miss breaks the streak. The alternative - counting it as a
        // near-win - is exactly the mechanism that makes players believe they
        // are "one away" more often than the maths says they are.
        streak: won ? state.streak + 1 : 0,
        bestStreak: won ? Math.max(state.bestStreak, state.streak + 1) : state.bestStreak,
        jackpot: advanceJackpot(state.jackpot, outcome),
        lastOutcome: outcome,
      };
    }

    case 'grant-energy': {
      if (action.amount <= 0) {
        return state;
      }
      return { ...state, energy: state.energy + action.amount };
    }

    case 'set-bet': {
      return { ...state, bet: clampBet(action.bet) };
    }

    case 'reset':
      return createSession(state.seed, state.energy);
  }
}

/**
 * Clamps a requested bet into the legal range and returns the Bet type, so the
 * compiler enforces the 1..3 bound instead of trusting a Math.min result.
 */
function clampBet(requested: number): Bet {
  const rounded = Math.round(requested);
  if (rounded <= 1) {
    return 1;
  }
  if (rounded >= 3) {
    return 3;
  }
  return 2;
}

function advanceJackpot(jackpot: JackpotState, outcome: SpinOutcome): JackpotState {
  if (outcome.tier === 'jackpot') {
    return { ...jackpot, amount: JACKPOT.seed };
  }
  // Bounded growth: the progressive stops at the cap instead of inflating into
  // a number nobody believes.
  const amount = Math.min(jackpot.cap, jackpot.amount + JACKPOT.growthPerSpin);
  return { ...jackpot, amount };
}