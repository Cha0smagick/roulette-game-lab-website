/**
 * Charts, drawn by hand on a Canvas.
 *
 * No charting library, and the reason is the budget in PLAN.md section 1: a
 * general-purpose chart library is an order of magnitude larger than everything
 * else in this bundle combined, and every kilobyte is a slower first paint on a
 * mid-range phone. It is also a dependency that would have to be audited and
 * updated forever, in a project whose entire claim is that it shows its work.
 *
 * The pure geometry is exported and tested with no canvas at all. The drawing
 * code is the thin part that reads those numbers.
 */

export interface EquitySeries {
  readonly id: string
  /** CSS colour. Assigned by the caller so the palette lives with the design. */
  readonly colour: string
  readonly points: readonly number[]
}

export interface Scale {
  readonly min: number
  readonly max: number
  readonly span: number
}

/**
 * A y-range covering every series at once.
 *
 * Sharing one range across systems is the entire point of the chart. Per-series
 * autoscale would make a system that lost ninety percent look identical to one
 * that won, which is the exact inversion the tool exists to prevent.
 *
 * A degenerate range (every series flat) is widened rather than divided by, so
 * a single line sitting still still renders as a line instead of NaN.
 */
export function equityScale(series: readonly EquitySeries[]): Scale {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const entry of series) {
    for (const point of entry.points) {
      if (point < min) min = point
      if (point > max) max = point
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, span: 1 }
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05)
    return { min: min - pad, max: max + pad, span: pad * 2 }
  }
  const pad = (max - min) * 0.06
  const lo = min - pad
  const hi = max + pad
  return { min: lo, max: hi, span: hi - lo }
}

const GRID = 'rgba(255,255,255,0.10)'
const AXIS = 'rgba(245,242,232,0.55)'
const ZERO = 'rgba(255,255,255,0.28)'

function dpr(): number {
  return Math.min(3, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)))
}

interface Frame {
  readonly ctx: CanvasRenderingContext2D
  readonly size: number
  readonly padTop: number
  readonly padRight: number
  readonly padBottom: number
  readonly padLeft: number
}

function prepare(canvas: HTMLCanvasElement): Frame {
  const ratio = dpr()
  const size = Math.max(120, Math.round(canvas.getBoundingClientRect().width || 320))
  const next = size * ratio
  if (canvas.width !== next) canvas.width = next
  if (canvas.height !== next) canvas.height = next
  const maybeCtx = canvas.getContext('2d')
  if (maybeCtx === null) throw new Error('2D canvas context unavailable')
  const ctx: CanvasRenderingContext2D = maybeCtx
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const padLeft = 44
  const padRight = 8
  const padTop = 10
  const padBottom = 20
  return { ctx, size, padTop, padRight, padBottom, padLeft }
}

function plotBox(frame: Frame): { x: number; y: number; w: number; h: number } {
  return {
    x: frame.padLeft,
    y: frame.padTop,
    w: Math.max(1, frame.size - frame.padLeft - frame.padRight),
    h: Math.max(1, frame.size - frame.padTop - frame.padBottom),
  }
}

/** Where a value lands on the canvas, for a given scale. Exported for tests. */
export function yFor(value: number, scale: Scale, box: { y: number; h: number }): number {
  return box.y + box.h - ((value - scale.min) / scale.span) * box.h
}

/** Where sample k lands horizontally. Exported for tests. */
export function xFor(k: number, length: number, box: { x: number; w: number }): number {
  if (length <= 1) return box.x
  return box.x + (k / (length - 1)) * box.w
}

/**
 * Five horizontal gridlines with value labels.
 *
 * Labels are numbers only. Words on an axis would be untranslatable copy, and
 * the unit of the axis is already stated once, in the page copy, where it can
 * be translated properly.
 */
function drawGrid(frame: Frame, scale: Scale): void {
  const box = plotBox(frame)
  const ctx = frame.ctx
  ctx.lineWidth = 1
  ctx.font = '600 10px "Helvetica Neue", Helvetica, Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= 4; i += 1) {
    const value = scale.min + (scale.span * i) / 4
    const y = yFor(value, scale, box)
    ctx.strokeStyle = value === 0 ? ZERO : GRID
    ctx.beginPath()
    ctx.moveTo(box.x, Math.round(y) + 0.5)
    ctx.lineTo(box.x + box.w, Math.round(y) + 0.5)
    ctx.stroke()
    ctx.fillStyle = AXIS
    ctx.fillText(Math.round(value).toString(), box.x - 6, y)
  }
}

export interface ChartOptions {
  /** Draw the value labels along the left edge. */
  readonly labels?: boolean
}

/**
 * Bankroll over time, one polyline per system.
 *
 * The line ends in a dot so the reader can find the endpoint of each curve
 * without tracing it, and the dot is placed from the same `xFor`/`yFor` used to
 * draw the line, so it cannot drift off its own line.
 */
export function drawEquityChart(
  canvas: HTMLCanvasElement,
  series: readonly EquitySeries[],
  options: ChartOptions = {},
): void {
  const frame = prepare(canvas)
  const box = plotBox(frame)
  const ctx = frame.ctx
  const scale = equityScale(series)
  if (options.labels !== false) drawGrid(frame, scale)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const entry of series) {
    if (entry.points.length === 0) continue
    ctx.strokeStyle = entry.colour
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let k = 0; k < entry.points.length; k += 1) {
      const point = entry.points[k] as number
      const x = xFor(k, entry.points.length, box)
      const y = yFor(point, scale, box)
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    const last = entry.points[entry.points.length - 1] as number
    const lastX = xFor(entry.points.length - 1, entry.points.length, box)
    const lastY = yFor(last, scale, box)
    ctx.fillStyle = entry.colour
    ctx.beginPath()
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

export interface Bar {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly colour: string
}

/**
 * One horizontal bar per system, scaled against a shared maximum.
 *
 * Shared maximum again. A bar chart with per-bar maxima is a chart of nothing.
 * Bars are drawn from zero even when every value is negative, because a bar
 * whose length is measured from its own minimum hides the sign, and the sign is
 * the finding.
 */
export function drawBarChart(canvas: HTMLCanvasElement, bars: readonly Bar[]): void {
  const frame = prepare(canvas)
  const ctx = frame.ctx
  const size = frame.size
  const padLeft = 96
  const padRight = 44
  const padTop = 8
  const usable = Math.max(1, size - padTop - 24)
  const row = usable / Math.max(1, bars.length)

  let lo = 0
  let hi = 0
  for (const bar of bars) {
    if (bar.value < lo) lo = bar.value
    if (bar.value > hi) hi = bar.value
  }
  if (lo === hi) hi = lo + 1
  const span = hi - lo
  const axisX = padLeft + ((0 - lo) / span) * (size - padLeft - padRight)

  ctx.font = '600 10px "Helvetica Neue", Helvetica, Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.strokeStyle = ZERO
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(Math.round(axisX) + 0.5, padTop)
  ctx.lineTo(Math.round(axisX) + 0.5, padTop + usable)
  ctx.stroke()

  bars.forEach((bar, index) => {
    const y = padTop + index * row + row * 0.28
    const h = Math.max(6, row * 0.44)
    const valueX = padLeft + ((bar.value - lo) / span) * (size - padLeft - padRight)
    ctx.fillStyle = bar.colour
    ctx.fillRect(Math.min(axisX, valueX), y, Math.max(1, Math.abs(valueX - axisX)), h)

    ctx.fillStyle = AXIS
    ctx.textAlign = 'right'
    ctx.fillText(bar.label, padLeft - 8, y + h / 2)

    ctx.textAlign = 'left'
    ctx.fillStyle = bar.colour
    ctx.fillText(
      Math.round(bar.value).toString(),
      bar.value >= 0 ? valueX + 6 : Math.max(4, valueX - 6),
      y + h / 2,
    )
  })
}