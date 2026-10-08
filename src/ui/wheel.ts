/**
 * Canvas renderer for the roulette wheel.
 *
 * Everything geometric lives in pure exported functions at the top of this file
 * so it can be tested without a canvas. The renderer below only paints what
 * those functions return; no arithmetic is done twice in two places.
 *
 * Angle convention, stated once here because getting it wrong is silent:
 * canvas angles are measured from the positive x axis with y pointing down, so
 * canvas angle 0 is 3 o'clock and growing angles travel clockwise. The pointer
 * sits at 12 o'clock, which is canvas angle -PI/2. `rotation` is a clockwise
 * offset applied to the whole wheel. A wedge's centre therefore lands on the
 * pointer when `rotation === -(index + 0.5) * sweep`.
 */

import { subscribe, easeOut, type Ticker } from './anim'
import { colourOf, type Pocket, type Wheel } from '../roulette/wheels'

export const TAU = Math.PI * 2

/** Reduce an angle into [0, TAU). */
export function normalize(angle: number): number {
  const wrapped = angle % TAU
  return wrapped < 0 ? wrapped + TAU : wrapped
}

/** Angular width of one pocket. */
export function sweepFor(count: number): number {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`sweepFor needs a positive integer pocket count, got ${String(count)}`)
  }
  return TAU / count
}

/** Rotation that brings the given pocket under the pointer. */
export function rotationLandingOn(index: number, count: number): number {
  const sweep = sweepFor(count)
  return -(index + 0.5) * sweep
}

/**
 * Which pocket currently sits under the pointer. The inverse of
 * `rotationLandingOn`, and clamped so a rounding artefact at TAU cannot return
 * an index past the end of the wheel.
 */
export function pocketAtPointer(rotation: number, count: number): number {
  const sweep = sweepFor(count)
  // Derivation, because the sign here is easy to get backwards and a wrong sign
  // does not crash, it just reports the wrong number as having won:
  //   draw() places pocket i's centre at canvas angle  -PI/2 + rotation + (i + 0.5) * sweep
  //   so pocket i's wedge spans            -PI/2 + rotation + [i, i + 1) * sweep
  //   the pointer sits at -PI/2, which is inside that wedge exactly when
  //     rotation + i * sweep <= 0 < rotation + (i + 1) * sweep
  //   i.e.   i * sweep <= -rotation < (i + 1) * sweep
  //   which is  i = floor(normalize(-rotation) / sweep)
  // The -PI/2 cancels out, which is why it does not appear below.
  const index = Math.floor(normalize(-rotation) / sweep)
  return Math.min(count - 1, Math.max(0, index))
}

/**
 * The number as printed in the pocket. The double zero is printed "00" but is
 * numerically the same value as "0", so the two are told apart by position: the
 * pocket at index 0 is the single zero, any later zero is the double.
 */
export function pocketLabel(wheel: Wheel, index: number): string {
  const value = wheel.pockets[index]
  if (value === undefined) {
    throw new RangeError(`pocketLabel: no pocket at index ${String(index)}`)
  }
  if (value !== 0) return String(value)
  return index === 0 ? '0' : '00'
}

/**
 * Canvas rotation for a pocket label, in the unrotated frame. Numbers on a
 * physical wheel are printed radially with their tops facing the hub, so a
 * label at the pointer reads upright and the same label at 3 o'clock is turned
 * 90 degrees anticlockwise. Returns zero at the pointer by construction.
 */
export function labelRotation(absoluteAngle: number): number {
  return -(absoluteAngle + Math.PI / 2)
}

/** Palette. Consolidated here so the wheel and the board cannot drift apart. */
const RED_FILL = '#9b1b30'
const BLACK_FILL = '#15151a'
const GREEN_FILL = '#0b5d3b'
const BRASS = '#c9a227'
const BRASS_DARK = '#6e5511'
const BONE = '#f5f2e8'

const SPIN_BASE_MS = 2600
const SPIN_MAX_MS = 5200
/** Whole turns added to the target so the spin reads as a spin, not a jump. */
const SPIN_TURNS = 4

export interface WheelRenderer {
  readonly wheel: Wheel
  /** Start a spin that comes to rest with the given pocket under the pointer. */
  spinTo(index: number): void
  isSpinning(): boolean
  /** Swap the wheel definition, e.g. when the player changes variant. */
  setWheel(wheel: Wheel): void
  /** Repaint at the current size, used on resize and on variant change. */
  resize(): void
  destroy(): void
}

export function createWheelRenderer(
  canvas: HTMLCanvasElement,
  wheel: Wheel,
): WheelRenderer {
  // Not `canvas.getContext('2d')!`. TS narrowing does not survive into the
  // hoisted declarations below, so the null check has to produce a typed local.
  const maybeCtx = canvas.getContext('2d')
  if (maybeCtx === null) throw new Error('2D canvas context unavailable')
  const ctx: CanvasRenderingContext2D = maybeCtx

  let current: Wheel = wheel
  let rotation = 0
  let spinning = false
  let from = 0
  let to = 0
  let startedAt: number | null = null
  let durationMs = SPIN_BASE_MS
  let unsubscribe: (() => void) | null = null
  let cssSize = 0

  const dpr = (): number =>
    Math.min(3, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)))

  const reducedMotion = (): boolean =>
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches

  function geometry(size: number) {
    const outer = size / 2
    const rimWidth = Math.max(6, size * 0.045)
    const markerRoom = size * 0.06
    const rOuter = outer - markerRoom - rimWidth
    const rInner = rOuter * 0.4
    return { outer, rimWidth, rOuter, rInner, labelR: (rInner + rOuter) / 2 }
  }

  function draw(): void {
    if (cssSize === 0) return
    const { outer, rimWidth, rOuter, rInner, labelR } = geometry(cssSize)
    const count = current.pockets.length
    const sweep = sweepFor(count)
    const fontSize = Math.max(9, Math.round(rOuter * 0.085))

    ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0)
    ctx.clearRect(0, 0, cssSize, cssSize)
    ctx.save()
    ctx.translate(outer, outer)

    // Pockets. Each is a truncated wedge between rInner and rOuter.
    for (let i = 0; i < count; i += 1) {
      const start = -Math.PI / 2 + rotation + i * sweep
      const end = start + sweep
      const pocket: Pocket = current.pockets[i] as Pocket
      const fill =
        pocket === 0 ? GREEN_FILL : colourOf(pocket) === 'red' ? RED_FILL : BLACK_FILL

      ctx.beginPath()
      ctx.arc(0, 0, rOuter, start, end)
      ctx.arc(0, 0, rInner, end, start, true)
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()

      ctx.strokeStyle = 'rgba(245, 242, 232, 0.22)'
      ctx.lineWidth = Math.max(1, cssSize * 0.0015)
      ctx.stroke()
    }

    // Rim: a brass ring outside the pockets, with a darker inner lip.
    ctx.beginPath()
    ctx.arc(0, 0, rOuter + rimWidth, 0, TAU)
    const rim = ctx.createLinearGradient(-rOuter, -rOuter, rOuter, rOuter)
    rim.addColorStop(0, BRASS)
    rim.addColorStop(0.5, BRASS_DARK)
    rim.addColorStop(1, BRASS)
    ctx.strokeStyle = rim
    ctx.lineWidth = rimWidth
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(0, 0, rOuter, 0, TAU)
    ctx.strokeStyle = 'rgba(11, 16, 38, 0.85)'
    ctx.lineWidth = Math.max(1, cssSize * 0.004)
    ctx.stroke()

    // Labels, printed radially with their tops toward the hub.
    ctx.fillStyle = BONE
    ctx.font = `700 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < count; i += 1) {
      const mid = -Math.PI / 2 + rotation + (i + 0.5) * sweep
      ctx.save()
      ctx.translate(Math.cos(mid) * labelR, Math.sin(mid) * labelR)
      ctx.rotate(labelRotation(mid))
      ctx.fillText(pocketLabel(current, i), 0, 0)
      ctx.restore()
    }

    // Hub: brass cone with a darker core, so the wheel reads as an object
    // rather than a flat disc.
    const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, rInner)
    hub.addColorStop(0, BRASS_DARK)
    hub.addColorStop(0.7, BRASS)
    hub.addColorStop(1, BRASS_DARK)
    ctx.beginPath()
    ctx.arc(0, 0, rInner, 0, TAU)
    ctx.fillStyle = hub
    ctx.fill()
    ctx.strokeStyle = 'rgba(11, 16, 38, 0.9)'
    ctx.lineWidth = Math.max(1, cssSize * 0.004)
    ctx.stroke()

    // Pointer, fixed at 12 o'clock while the wheel turns beneath it.
    const tipY = -(rOuter + rimWidth) - Math.max(4, cssSize * 0.012)
    const halfW = cssSize * 0.018
    const backY = tipY - cssSize * 0.045
    ctx.beginPath()
    ctx.moveTo(0, tipY)
    ctx.lineTo(-halfW, backY)
    ctx.lineTo(halfW, backY)
    ctx.closePath()
    ctx.fillStyle = BONE
    ctx.fill()

    ctx.restore()
  }

  function measure(): void {
    const rect = canvas.getBoundingClientRect()
    const next = Math.max(1, Math.round(Math.min(rect.width, rect.height) || cssSize))
    if (next === cssSize) return
    cssSize = next
    const scale = dpr()
    canvas.width = Math.round(next * scale)
    canvas.height = Math.round(next * scale)
    draw()
  }

  const ticker: Ticker = (_dt, elapsedMs) => {
    if (!spinning) return
    // The first tick of a spin anchors the clock. `elapsedMs` comes from the
    // shared loop's own accumulator and is NOT comparable to performance.now(),
    // so the tween must be anchored to the first tick it actually receives.
    if (startedAt === null) startedAt = elapsedMs
    const t = Math.min(1, (elapsedMs - startedAt) / durationMs)
    rotation = from + (to - from) * easeOut(t)
    draw()
    if (t >= 1) {
      // Land exactly on the target rather than wherever the easing stopped.
      rotation = to
      spinning = false
      stopLoop()
      draw()
    }
  }

  function startLoop(): void {
    if (unsubscribe === null) unsubscribe = subscribe(ticker)
  }

  function stopLoop(): void {
    if (unsubscribe !== null) {
      unsubscribe()
      unsubscribe = null
    }
  }

  const observer =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null
  observer?.observe(canvas)
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('orientationchange', measure)
  }
  measure()

  return {
    get wheel() {
      return current
    },
    spinTo(index: number): void {
      const count = current.pockets.length
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        throw new RangeError(`spinTo: pocket index ${String(index)} out of range`)
      }
      const target = rotationLandingOn(index, count)

      if (reducedMotion()) {
        // Land on the pocket without the intervening turns. The result is the
        // same table state, reached without the motion the player asked not to see.
        rotation = target
        spinning = false
        stopLoop()
        draw()
        return
      }

      // Continue from wherever the wheel visually is, including mid-tween, so a
      // retarget never snaps backwards.
      from = rotation
      const forward = normalize(target - from)
      to = from + forward + SPIN_TURNS * TAU
      // Time scales with how far the wheel actually travels, so a short hop
      // between neighbouring pockets feels short and a full sweep feels long.
      const pocketsTravelled = (forward / TAU) * count + SPIN_TURNS * count
      durationMs = Math.min(SPIN_MAX_MS, SPIN_BASE_MS + pocketsTravelled * 6)
      startedAt = null
      spinning = true
      startLoop()
      draw()
    },
    isSpinning(): boolean {
      return spinning
    },
    setWheel(next: Wheel): void {
      current = next
      rotation = 0
      spinning = false
      stopLoop()
      draw()
    },
    resize(): void {
      measure()
    },
    destroy(): void {
      spinning = false
      stopLoop()
      observer?.disconnect()
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('orientationchange', measure)
      }
    },
  }
}