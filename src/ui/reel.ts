import type { SymbolId } from '../game/types';
import { SYMBOLS } from '../game/paytable';
import { easeOut, easeOutBack, lerp, subscribe } from './anim';

/**
 * Canvas reel renderer.
 *
 * Canvas rather than DOM/CSS transforms because the reels scroll continuously
 * through a symbol strip. Animating that with CSS means either a transform per
 * symbol node (a DOM node per symbol per frame, hundreds of them) or a very long
 * keyframe timeline. One canvas, one draw call per reel, no node churn.
 */

const REEL_COUNT = 3;
/** Symbols visible in the strip. Must be odd so one row can sit dead centre. */
const STRIP_SIZE = 9;
const CENTRE_ROW = Math.floor(STRIP_SIZE / 2);

/** Extra scroll distance so a reel passes a full lap before settling. */
const LAP_SYMBOLS = 4;
const BASE_DURATION_MS = 1_100;
const STAGGER_MS = 160;

const COLORS = {
  bg: '#131A3A',
  border: '#0B1026',
  highlight: 'rgba(255, 255, 255, 0.07)',
  centre: 'rgba(255, 176, 58, 0.14)',
} as const;

export interface ReelRenderer {
  /** Starts the visual spin. The outcome is already resolved by this point. */
  spin(outcome: readonly [SymbolId, SymbolId, SymbolId]): void;
  /** True while any reel is still moving. */
  isSpinning(): boolean;
  destroy(): void;
}

/**
 * Placeholder strip shown before the first spin. Replaced wholesale on every
 * spin by createStripWithTarget, so its only job is to look plausible at boot.
 */
function buildStrip(reelIndex: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (let i = 0; i < STRIP_SIZE; i += 1) {
    strip.push(((i + reelIndex) % SYMBOLS.length) as SymbolId);
  }
  return strip;
}

export function createReelRenderer(canvas: HTMLCanvasElement): ReelRenderer {
  const maybeCtx = canvas.getContext('2d');
  if (maybeCtx === null) {
    throw new Error('2d canvas context unavailable');
  }
  // Bound to a new const so the non-null narrowing survives into the hoisted
  // function declarations below, which run before the check in control flow.
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let dpr = 1;
  let width = 0;
  let height = 0;

  // Per-reel scroll state: offset is in symbol units.
  const strips: SymbolId[][] = [buildStrip(0), buildStrip(1), buildStrip(2)];
  const targets: SymbolId[] = [0, 0, 0];
  const offsets: number[] = [0, 0, 0];
  const startOffsets: number[] = [0, 0, 0];
  const starts: number[] = [-1, -1, -1];
  const durations: number[] = [0, 0, 0];
  /** Monotonic spin counter, seeds the strip layout so spins differ visually. */
  let spinCount = 0;

  function resize(): void {
    // Backing store scales by devicePixelRatio so text is crisp on a 3x phone.
    // Without this every label looks like blurry MS Paint output.
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const rowHeight = (): number => height / STRIP_SIZE;

  function draw(): void {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const reelWidth = width / REEL_COUNT;
    const rh = rowHeight();
    const fontSize = Math.min(26, rh * 0.42);

    for (let reel = 0; reel < REEL_COUNT; reel += 1) {
      const x0 = reel * reelWidth;

      ctx.fillStyle = COLORS.border;
      ctx.fillRect(x0 + 1, 0, reelWidth - 2, height);

      // Centre band marks the payline. Drawn, not implied, so the result of a
      // spin is unambiguous at a glance on a small screen.
      ctx.fillStyle = COLORS.centre;
      ctx.fillRect(x0 + 1, CENTRE_ROW * rh, reelWidth - 2, rh);
      ctx.strokeStyle = 'rgba(255, 176, 58, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 2, CENTRE_ROW * rh + 1, reelWidth - 4, rh - 2);

      const strip = strips[reel] ?? [];
      const offset = offsets[reel] ?? 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;

      // Draw only the rows on screen. With STRIP_SIZE 9 this is 9 draw calls per
      // reel; scrolling never grows that count.
      for (let row = 0; row < STRIP_SIZE; row += 1) {
        // Wrapped index into the strip keeps symbols continuous past the ends.
        const stripIndex =
          ((row + Math.floor(offset)) % STRIP_SIZE + STRIP_SIZE) % STRIP_SIZE;
        const symbolId = strip[stripIndex];
        if (symbolId === undefined) {
          continue;
        }
        const symbol = SYMBOLS.find((s) => s.id === symbolId);
        if (symbol === undefined) {
          continue;
        }
        const y = row * rh + rh / 2 - (offset - Math.floor(offset)) * rh;
        if (y < -rh || y > height + rh) {
          continue;
        }

        // Row nearest the centre line draws full opacity, rows fade outward.
        const distance = Math.abs(row - CENTRE_ROW);
        const alpha = distance === 0 ? 1 : Math.max(0.15, 1 - distance * 0.28);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = symbol.color;
        const label = symbol.label;
        // Long labels shrink to fit rather than overflow the reel width.
        const size = label.length > 4 ? fontSize * 0.68 : fontSize;
        ctx.font = `700 ${size}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
        ctx.fillText(label, x0 + reelWidth / 2, y, reelWidth * 0.86);
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = COLORS.highlight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, 0);
      ctx.lineTo(x0 + 0.5, height);
      ctx.stroke();
    }

    // Outer frame.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
  }

  function update(dt: number): void {
    let anyMoving = false;
    const now = performance.now();

    for (let reel = 0; reel < REEL_COUNT; reel += 1) {
      const start = starts[reel] ?? -1;
      const duration = durations[reel] ?? 0;
      if (start < 0 || duration <= 0) {
        continue;
      }
      const elapsed = now - start;
      if (elapsed >= duration) {
        // Snap exactly onto the centre row. Leaving a fractional remainder
        // produces a visible half-symbol jump on the last frame.
        offsets[reel] = Math.round(targets[reel] ?? 0) + LAP_SYMBOLS;
        starts[reel] = -1;
        continue;
      }

      const t = elapsed / duration;
      // Middle reel settles with a small overshoot so the win lands with weight.
      const eased = reel === 1 ? easeOutBack(t) : easeOut(t);
      offsets[reel] = lerp(startOffsets[reel] ?? 0, (targets[reel] ?? 0) + LAP_SYMBOLS, eased);
      anyMoving = true;
    }

    void dt;
    draw();
    void anyMoving;
  }

  const unsubscribe = subscribe(update);

  const onResize = (): void => {
    resize();
  };
  window.addEventListener('resize', onResize, { passive: true });
  // orientationchange fires on phones and resize alone is unreliable there.
  window.addEventListener('orientationchange', onResize, { passive: true });

  resize();

  return {
    spin(outcome) {
      const now = performance.now();
      for (let reel = 0; reel < REEL_COUNT; reel += 1) {
        const symbolId = outcome[reel] ?? 0;
        targets[reel] = symbolId;
        startOffsets[reel] = offsets[reel] ?? 0;
        starts[reel] = now + reel * STAGGER_MS;
        durations[reel] = BASE_DURATION_MS + reel * STAGGER_MS;

        // Rebuild the strip with the outcome symbol at CENTRE_ROW. The reel is
        // already scrolling at speed, so the surrounding symbols only need to
        // look varied; the payline result is what has to be exact.
        const strip: SymbolId[] = new Array<SymbolId>(STRIP_SIZE);
        strip[CENTRE_ROW] = symbolId;
        let salt = spinCount * 131 + reel * 17;
        for (let row = 0; row < STRIP_SIZE; row += 1) {
          if (row === CENTRE_ROW) {
            continue;
          }
          salt = (salt * 1_103_515_245 + 12_345) % 2_147_483_648;
          strip[row] = (salt % 100) < 55 ? symbolId : ((salt >> 7) % 5) as SymbolId;
        }
        strips[reel] = strip;
      }
      spinCount += 1;
    },
    isSpinning() {
      return starts.some((s) => s >= 0);
    },
    destroy() {
      unsubscribe();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    },
  };
}