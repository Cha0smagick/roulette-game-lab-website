import './styles/base.css';
import './styles/reel.css';
import './styles/break.css';
import { mountSession } from './game/session';

/**
 * App entry.
 *
 * The boot markup lives in index.html so a failed bundle shows a styled message
 * instead of a blank page. Here we only confirm the mount point resolved, then
 * hand off to the session controller.
 */
function mount(): void {
  const root = document.getElementById('app');

  // Cannot be null given index.html, but if the id is ever removed the failure
  // should be loud rather than a silent no-op on a blank page.
  if (root === null) {
    throw new Error('mount point #app not found in index.html');
  }

  root.className = 'game';
  root.setAttribute('role', 'main');

  const session = mountSession(root);

  // Exposed for debugging a disputed spin from the console: type the seed in
  // and every reel result can be replayed against the published paytable.
  (window as unknown as { reelazo?: { seed: () => string } }).reelazo = {
    seed: () => session.getState().seed,
  };
}

mount();