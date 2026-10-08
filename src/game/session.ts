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
import { createBreakOverlay, type BreakOverlay } from '../ui/break';
import { createMockProvider } from '../ads/mock';
import { isBreakDue, runBreak, spinsUntilBreak, DEFAULT_CADENCE } from '../ads/cadence';
import type { AdProvider } from '../ads/provider';

/** Spins between commercial breaks. Tuned by the cadence module, not here. */
const spinsPerBreak = DEFAULT_CADENCE.spinsPerBreak;

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

export function mountSession(root: HTMLElement, provider?: AdProvider): Session {
  const ads: AdProvider = provider ?? createMockProvider();
  const hud = createHud(root);
  const breakOverlay: BreakOverlay = createBreakOverlay(document.body);

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
    return spinsUntilBreak(state.spinIndex, spinsPerBreak);
  }

  function paint(): void {
    renderHud(hud, state, spinsToBreak());
  }

  /**
   * Runs the commercial break, then credits the fuel it owed.
   *
   * The grant happens here, after runBreak resolves, and comes from the cadence
   * module's constant. Nothing an ad reports, and nothing a click does, reaches
   * this function. See src/ads/provider.ts for why that matters.
   */
  async function takeBreak(): Promise<void> {
    const [energy] = await Promise.all([runBreak(ads), breakOverlay.run()]);
    if (energy.energy > 0) {
      dispatch({ type: 'grant-energy', amount: energy.energy });
    }
    paint();
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

    // The break is due on the boundary. Scheduling it here rather than from a
    // timer guarantees it never lands mid-animation or mid-bonus.
    if (isBreakDue(state.spinIndex, spinsPerBreak) && !breakOverlay.isOpen()) {
      void takeBreak();
    }
  }

  hud.spinButton.addEventListener('click', onSpin);

  // Loading never rejects, so this cannot reject either.
  void ads.load();

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