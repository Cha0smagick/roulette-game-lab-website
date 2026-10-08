/**
 * Single animation loop, driven by delta time.
 *
 * Why one loop and not a per-component loop: three separate rAF loops fight each
 * other for the frame budget, and on a mid-range Android they interleave badly
 * enough to produce visible judder. One loop, one timestamp, one update pass.
 *
 * Why delta time and not frame counts: a 120Hz phone and a 60Hz laptop must spin
 * at the same speed. Frame counting makes the game twice as fast on one device
 * than the other, which changes how long a spin lasts and therefore how long a
 * session lasts.
 */
export type Ticker = (dtMs: number, elapsedMs: number) => void;

const subscribers = new Set<Ticker>();
let rafId: number | null = null;
let lastTime = 0;
let elapsed = 0;

/** Frame delta is clamped so a backgrounded tab does not teleport the reels. */
const MAX_DT_MS = 50;

function frame(now: number): void {
  const dt = Math.min(now - lastTime, MAX_DT_MS);
  lastTime = now;
  elapsed += dt;

  for (const ticker of subscribers) {
    ticker(dt, elapsed);
  }

  rafId = requestAnimationFrame(frame);
}

export function subscribe(ticker: Ticker): () => void {
  subscribers.add(ticker);

  if (rafId === null) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  return () => {
    subscribers.delete(ticker);
    // Stop the loop once nothing is watching. A spinning rAF with an empty
    // subscriber set burns battery on a page the player has scrolled away from.
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/** Ease-out cubic. Fast start, long settle. Reads as mechanical weight. */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

/** Ease-out with a slight overshoot, used on the winning reel. */
export function easeOutBack(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const c = 1.70158 * 1.2;
  const shifted = clamped - 1;
  return 1 + (c + 1) * shifted ** 3 + c * shifted ** 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}