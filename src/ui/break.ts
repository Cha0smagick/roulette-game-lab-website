/**
 * Break overlay.
 *
 * A full-screen, clearly-badged commercial break. The player knows exactly what
 * it is, exactly how long it runs, and exactly what it pays. Nothing about it is
 * sprung on them.
 *
 * Two placement rules from the design, both enforced by this being a deliberate
 * modal that the game schedules between spins:
 *
 * - It never appears during a spin animation or a bonus round. An ad sliding in
 *   over moving reels is where accidental clicks come from, and accidental
 *   clicks are both a policy violation and a player who loses the run.
 * - It never offers a skip button. A skippable break lowers viewability, and
 *   viewability is what the slot is priced on. Telling the player that up front
 *   is the honest version of the same choice.
 */

export interface BreakOverlay {
  /** Opens the break and resolves when it is over. */
  run(): Promise<void>;
  /** True while the break is on screen. */
  isOpen(): boolean;
}

const BREAK_MS = 5_000;

export function createBreakOverlay(root: HTMLElement): BreakOverlay {
  const overlay = document.createElement('div');
  overlay.className = 'break';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Pausa publicitaria');

  const inner = document.createElement('div');
  inner.className = 'break__inner';

  const badge = document.createElement('p');
  badge.className = 'break__badge';
  badge.textContent = 'Pausa publicitaria';

  // The slot where the network renders. Kept in its own box so network CSS can
  // never bleed into the game, and so an ad can never float over the controls.
  const slot = document.createElement('div');
  slot.className = 'break__slot';

  const reward = document.createElement('p');
  reward.className = 'break__reward';

  const countdown = document.createElement('p');
  countdown.className = 'break__countdown';

  inner.append(badge, slot, reward, countdown);
  overlay.append(inner);
  root.append(overlay);

  let open = false;

  return {
    run() {
      if (open) {
        return Promise.resolve();
      }
      open = true;
      overlay.classList.add('break--open');
      reward.textContent = `Al terminar: +${5} de energia para seguir girando`;

      return new Promise<void>((resolve) => {
        let remaining = Math.ceil(BREAK_MS / 1000);
        countdown.textContent = `${remaining}s`;

        const timer = window.setInterval(() => {
          remaining -= 1;
          countdown.textContent = `${Math.max(0, remaining)}s`;
        }, 1000);

        const done = (): void => {
          window.clearInterval(timer);
          overlay.classList.remove('break--open');
          open = false;
          resolve();
        };

        // The ad network's own completion callback is the preferred signal, but
        // on web a provider cannot be relied on to report one. The fallback
        // timer is what guarantees the player always gets their energy back.
        window.setTimeout(done, BREAK_MS);
      });
    },

    isOpen() {
      return open;
    },
  };
}