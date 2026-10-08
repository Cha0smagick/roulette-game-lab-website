import './styles/base.css';

/**
 * F1 shell mount.
 *
 * Deliberately minimal: F1 only proves that a strict TypeScript bundle builds
 * and renders a mobile-first viewport. Game logic lands in F2 onward.
 *
 * The boot markup lives in index.html so a failed bundle shows a styled message
 * instead of a blank page. Here we simply confirm the mount point resolved.
 */
function mount(): void {
  const root = document.getElementById('app');

  // This cannot be null given index.html, but if someone edits the markup and
  // removes the id the failure should be loud, not a silent no-op.
  if (root === null) {
    throw new Error('mount point #app not found in index.html');
  }

  root.className = '';
  root.setAttribute('role', 'main');

  const shell = document.createElement('div');
  shell.className = 'shell';

  const brand = document.createElement('h1');
  brand.className = 'shell__brand';
  brand.textContent = 'REELAZO';

  const tagline = document.createElement('p');
  tagline.className = 'shell__tagline';
  tagline.textContent = 'La publicidad es tu combustible.';

  shell.append(brand, tagline);
  root.append(shell);
}

mount();