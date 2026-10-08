import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the two mobile failures that cost a session before a single frame of
 * gameplay renders. Both are invisible in desktop testing and fatal on a phone.
 */
describe('index.html mobile contract', () => {
  const html = readFileSync(
    fileURLToPath(new URL('../index.html', import.meta.url)),
    'utf8',
  );

  it('declares width=device-width so phones do not render a desktop viewport', () => {
    expect(html).toContain('width=device-width');
  });

  it('sets initial-scale=1 to stop iOS from zooming the layout', () => {
    expect(html).toContain('initial-scale=1');
  });

  it('sets viewport-fit=cover so safe-area insets are non-zero on notched phones', () => {
    expect(html).toContain('viewport-fit=cover');
  });

  it('ships boot markup outside the bundle so a failed load is never a blank page', () => {
    expect(html).toContain('id="app"');
    expect(html).toContain('Cargando');
  });
});