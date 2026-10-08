/**
 * Session controller: wires DOM events to the reducer, and the renderer to the
 * reducer's output.
 *
 * Kept separate from both the UI helpers and the pure game logic so the reducer
 * stays testable without a DOM, and so the renderer knows nothing about state.
 */

import { canSpin, createSession, reduce, type SessionState } from '../game/reducer';
import type { SessionAction } from '../game/reducer';
import type { Bet } from '../game/types';
import { createReelRenderer, type ReelRenderer } from '../ui/reel';
import { createHud, renderHud } from '../ui/hud';

/** Spins between commercial breaks. Set by cadence.ts in F4. */
let spinsPerBreak = 5;

export interface Session {
  getState(): SessionState;
  destroy(): void;
}

/**
 * Builds a session seed that is visible to the player and stable for the tab
 * session. A reload starts a new audit trail rather than resuming a half-faded
 * one, which keeps "replay this spin" unambiguous.
 */
function newSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    const index = byte % alphabet.length;
    out += alphabet.charAt(index);
  }
  return out;
}

export function mountSession(root: HTMLElement): Session {
  const hud = createHud(root);

  const canvas = document.createElement('canvas');
  canvas.className = 'reels';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Tragamonedas de tres rodillos');
  root.prepend(canvas);

  const reels: ReelRenderer = createReelRenderer(canvas);

  let state = createSession(newSeed());

  function dispatch(action: SessionAction): void {
    const next = reduce(state, action);
    // The reducer returns the same object for a no-op spin (double tap while
    // broke). Skipping the render in that case avoids a wasted canvas repaint.
    if (next !== state) {
      state = next;
      paint();
    }
  }

  function spinsToBreak(): number {
    const used = state.spinIndex % spinsPerBreak;
    return used === 0 ? spinsPerBreak : spinsPerBreak - used;
  }

  function paint(): void {
    renderHud(hud, state, spinsToBreak());
  }

  function onSpin(): void {
    if (reels.isSpinning() || !canSpin(state)) {
      return;
    }
    dispatch({ type: 'spin' });
    const outcome = state.lastOutcome;
    if (outcome !== null) {
      reels.spin(outcome.reels);
    }
  }

  hud.spinButton.addEventListener('click', onSpin);

  const onBet = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const raw = Number(target.dataset.bet ?? '1');
    const bet: Bet = raw === 2 ? 2 : raw === 3 ? 3 : 1;
    dispatch({ type: 'set-bet', bet });
  };
  for (const button of hud.betControls) {
    button.addEventListener('click', onBet);
  }

  paint();

  return {
    getState: () => state,
    destroy() {
      reels.destroy();
    },
  };
}

/** Exposed so the F4 break scheduler can tune cadence without a new config file. */
export function setSpinsPerBreak(spins: number): void {
  if (Number.isInteger(spins) && spins > 0) {
    spinsPerBreak = spins;
  }
}