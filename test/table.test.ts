import { describe, expect, it } from 'vitest'

import {
  CHIPS,
  INITIAL_TABLE,
  STARTING_BALANCE,
  isLegal,
  placementKey,
  pendingWager,
  reduce,
  type TableState,
} from '../src/game/table.js'
import { totalStake } from '../src/roulette/settle.js'
import { isSplitPair, overlayPlacements } from '../src/ui/board.js'
import { EUROPEAN } from '../src/roulette/wheels.js'
import type { BetPlacement } from '../src/roulette/bets.js'

const straight17: BetPlacement = { kind: 'straight', numbers: [17] }
const straight19: BetPlacement = { kind: 'straight', numbers: [19] }
const red: BetPlacement = { kind: 'red' }

/**
 * The default chip is 5, so every arithmetic assertion below would be reading a
 * multiple of 5. Tests that check stake arithmetic pin the chip to 1 instead,
 * which keeps the expected numbers readable.
 */
const START: TableState = reduce(INITIAL_TABLE, { type: 'set-chip', chip: 1 })

function place(state: TableState, placement: BetPlacement, times = 1): TableState {
  let next = state
  for (let i = 0; i < times; i += 1) {
    next = reduce(next, { type: 'place', placement });
  }
  return next
}

describe('table reducer', () => {
  it('starts with the full bankroll and no bets', () => {
    expect(INITIAL_TABLE.balance).toBe(STARTING_BALANCE);
    expect(INITIAL_TABLE.bets).toHaveLength(0);
    expect(pendingWager(INITIAL_TABLE)).toBe(0);
  })

  it('offers ascending chip denominations', () => {
    expect(CHIPS).toEqual([1, 5, 25, 100]);
  })

  it('debits the stake when a bet is placed', () => {
    const next = place(reduce(INITIAL_TABLE, { type: 'set-chip', chip: 25 }), straight17);
    expect(next.balance).toBe(STARTING_BALANCE - 25);
    expect(pendingWager(next)).toBe(25);
  })

  it('stacks repeated taps onto a single record rather than one per tap', () => {
    const next = place(START, straight17, 3);
    expect(next.bets).toHaveLength(1);
    expect(next.bets[0]?.stake).toBe(3);
    expect(pendingWager(next)).toBe(3);
  })

  it('treats the same numbers in either order as one bet', () => {
    expect(placementKey({ kind: 'split', numbers: [17, 18] })).toBe(
      placementKey({ kind: 'split', numbers: [18, 17] }),
    );
  });

  it('gives distinct placements distinct keys', () => {
    expect(placementKey(straight17)).not.toBe(placementKey(straight19));
    expect(placementKey(red)).not.toBe(placementKey(straight17));
  });

  it('refuses to stake more than the balance holds', () => {
    const poor: TableState = { ...INITIAL_TABLE, balance: 3, chip: 25 };
    const next = reduce(poor, { type: 'place', placement: straight17 });
    // Identical object, so the caller skips the repaint.
    expect(next).toBe(poor);
    expect(next.balance).toBe(3);
  });

  it('never lets the balance go negative', () => {
    let state: TableState = { ...INITIAL_TABLE, balance: 2, chip: 1 };
    for (let i = 0; i < 50; i += 1) {
      state = reduce(state, { type: 'place', placement: straight17 });
    }
    expect(state.balance).toBeGreaterThanOrEqual(0);
  });

  it('rejects an illegal placement without touching the balance', () => {
    const next = reduce(INITIAL_TABLE, { type: 'place', placement: { kind: 'straight' } });
    expect(next).toBe(INITIAL_TABLE);
  });

  it('refunds every stake on clear', () => {
    const staked = place(place(START, straight17, 2), red, 1);
    const cleared = reduce(staked, { type: 'clear' });
    expect(cleared.balance).toBe(STARTING_BALANCE);
    expect(cleared.bets).toHaveLength(0);
  });

  it('refunds only the last stake on undo', () => {
    const staked = place(place(START, straight17, 2), red, 1);
    const undone = reduce(staked, { type: 'undo' });
    expect(undone.balance).toBe(STARTING_BALANCE - 2);
    expect(undone.bets).toHaveLength(1);
  });

  it('rebets the previous spin all or nothing', () => {
    const staked = place(START, straight17, 2);
    const spun = reduce(staked, { type: 'spin', outcome: 19 });
    expect(spun.bets).toHaveLength(0);
    expect(spun.lastBets).toHaveLength(1);
    const rebet = reduce(spun, { type: 'rebet' });
    expect(rebet.bets).toHaveLength(1);
    expect(pendingWager(rebet)).toBe(2);
    // Rebeting costs the stake again, which is what makes it a bet.
    expect(rebet.balance).toBe(spun.balance - 2);
  });

  it('refuses a rebet the balance cannot cover', () => {
    const staked = place(START, straight17, 2);
    const spun = reduce(staked, { type: 'spin', outcome: 19 });
    const broke: TableState = { ...spun, balance: 0 };
    const rebet = reduce(broke, { type: 'rebet' });
    // A partial rebet would silently drop bets the player asked to repeat.
    expect(rebet).toBe(broke);
    expect(rebet.bets).toHaveLength(0);
  });

  it('applies the settlement net to the balance on a spin', () => {
    const staked = place(START, straight17, 2);
    const spun = reduce(staked, { type: 'spin', outcome: 17 });
    // A straight-up at 35:1 with a stake of 2 returns 2 + 2*35.
    expect(spun.lastSettlement?.returned).toBe(72);
    expect(spun.lastSettlement?.net).toBe(70);
    // The stake was already debited when the bet was placed, so the win adds
    // the net on top of the already-reduced balance rather than the full return.
    expect(spun.balance).toBe(staked.balance + 70);
    expect(spun.balance).toBe(STARTING_BALANCE + 68);
    expect(spun.lastOutcome).toBe(17);
  });

  it('moves bets to lastBets and clears the board on a spin', () => {
    const staked = place(START, red, 1);
    const spun = reduce(staked, { type: 'spin', outcome: 5 });
    expect(spun.bets).toHaveLength(0);
    expect(spun.lastBets).toHaveLength(1);
    expect(totalStake(spun.lastBets)).toBe(1);
  });

  it('keeps the total wager equal to the sum of the stakes', () => {
    const staked = place(place(place(START, straight17, 2), straight19, 3), red, 1);
    expect(pendingWager(staked)).toBe(6);
    expect(staked.balance).toBe(STARTING_BALANCE - 6);
  })

  it('agrees with the engine on the house edge across a long run', () => {
    // 200 straight-ups on an ordinary number: every spin costs the stake and
    // 1 in 36 returns 36x. The balance must converge downwards, never upwards.
    let state = { ...INITIAL_TABLE, chip: 1 } as TableState;
    for (let i = 0; i < 3600; i += 1) {
      state = reduce(reduce(state, { type: 'place', placement: straight17 }), {
        type: 'spin',
        outcome: EUROPEAN.pockets[(i * 7 + 3) % EUROPEAN.pockets.length] as number,
      });
    }
    expect(state.balance).toBeLessThan(STARTING_BALANCE);
  });
})

describe('placementKey', () => {
  it('keys a split by its sorted numbers', () => {
    expect(placementKey({ kind: 'split', numbers: [1, 2] })).toBe('split:1,2');
  });

  it('keys a group bet by its group', () => {
    expect(placementKey({ kind: 'column', group: 3 })).toBe('column:3');
    expect(placementKey({ kind: 'column', group: 1 })).toBe('column:1');
  });
});

describe('isLegal', () => {
  it('accepts a straight-up on an ordinary number', () => {
    expect(isLegal(straight17)).toBe(true);
  });

  it('accepts a zero as a pocket value', () => {
    expect(isLegal({ kind: 'straight', numbers: [0] })).toBe(true);
  });

  it('rejects a placement with no numbers', () => {
    expect(isLegal({ kind: 'split', numbers: [] })).toBe(false);
  });

  it('rejects a pocket outside 0..36', () => {
    expect(isLegal({ kind: 'straight', numbers: [37] })).toBe(false);
    expect(isLegal({ kind: 'straight', numbers: [-1] })).toBe(false);
  });

  it('rejects a non-integer pocket', () => {
    expect(isLegal({ kind: 'straight', numbers: [1.5] })).toBe(false);
  });

  it('rejects a group outside 1..3', () => {
    expect(isLegal({ kind: 'column', group: 0 })).toBe(false);
    expect(isLegal({ kind: 'column', group: 4 })).toBe(false);
    expect(isLegal({ kind: 'dozen', group: 1 })).toBe(true);
  });
});

describe('isSplitPair', () => {
  it('joins neighbours within a street', () => {
    expect(isSplitPair(1, 2)).toBe(true);
    expect(isSplitPair(4, 5)).toBe(true);
  });

  it('joins neighbours in the same column', () => {
    expect(isSplitPair(1, 4)).toBe(true);
    expect(isSplitPair(16, 19)).toBe(true);
  });

  it('refuses numbers that touch diagonally but are not in one line', () => {
    // 3 and 6 are diagonal neighbours on the felt, not a vertical pair.
    expect(isSplitPair(3, 7)).toBe(false);
  });

  it('refuses non-neighbours in the same street', () => {
    expect(isSplitPair(1, 3)).toBe(false);
  });

  it('lets the zero split only with the first street', () => {
    expect(isSplitPair(0, 1)).toBe(true);
    expect(isSplitPair(0, 2)).toBe(true);
    expect(isSplitPair(0, 3)).toBe(true);
    expect(isSplitPair(0, 4)).toBe(false);
  });

  it('is symmetric in its arguments', () => {
    for (const [a, b] of [[1, 2], [3, 6], [0, 5], [17, 20], [10, 33]] as const) {
      expect(isSplitPair(a, b)).toBe(isSplitPair(b, a));
    }
  });
});

describe('board overlay geometry', () => {
  const all = overlayPlacements();

  it('offers twelve streets, twenty-two corners and eleven lines', () => {
    expect(all.filter((entry) => entry.kind === 'street')).toHaveLength(12);
    expect(all.filter((entry) => entry.kind === 'corner')).toHaveLength(22);
    expect(all.filter((entry) => entry.kind === 'line')).toHaveLength(11);
  });

  it('covers three, four and six numbers respectively', () => {
    for (const entry of all) {
      const expected = entry.kind === 'street' ? 3 : entry.kind === 'corner' ? 4 : 6;
      expect(new Set(entry.numbers).size).toBe(expected);
    }
  });

  it('never includes a pocket outside 1..36', () => {
    for (const entry of all) {
      for (const pocket of entry.numbers) {
        expect(pocket).toBeGreaterThanOrEqual(1);
        expect(pocket).toBeLessThanOrEqual(36);
      }
    }
  });

  it('offers no duplicate placement, so no two buttons mean the same bet', () => {
    const keys = all.map((entry) => placementKey({ kind: entry.kind, numbers: entry.numbers }));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('starts every street on a number that is 1 mod 3', () => {
    for (const entry of all.filter((e) => e.kind === 'street')) {
      expect((entry.numbers[0] as number) % 3).toBe(1);
    }
  });
});