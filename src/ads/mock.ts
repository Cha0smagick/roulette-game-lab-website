import type { AdProvider, AdResult, AdSlot } from './provider';

/**
 * Deterministic mock provider.
 *
 * This is what runs in dev, in tests, and in production until a publisher zone ID
 * exists. It exists so the game is fully playable with zero network calls, which
 * also means the game works with an ad blocker on and in CI.
 *
 * It deliberately simulates ads that never render. That is the common real case:
 * an ad blocker, a failed fill, a throttled connection. The game must stay
 * playable through it, and testing only against a happy path would hide the bug
 * that ends the session.
 */
export function createMockProvider(options: { readonly delayMs?: number } = {}): AdProvider {
  const delayMs = options.delayMs ?? 900;
  let ready = false;

  return {
    async load() {
      ready = true;
    },

    async show(slot: AdSlot): Promise<AdResult> {
      if (!ready) {
        return { reason: 'unavailable', viewedMs: 0, rendered: false };
      }
      // setTimeout, not a busy wait: the UI must keep painting during a break.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
      void slot;
      return { reason: 'completed', viewedMs: delayMs, rendered: false };
    },

    isReady() {
      return ready;
    },
  };
}