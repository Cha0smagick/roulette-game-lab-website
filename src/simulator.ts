import './styles/base.css'
import './styles/sim.css'
import { applyTranslations, formatCurrency, formatPercent, initI18n, t } from './i18n/index.js'
import type { TranslationKey } from './i18n/index.js'
import { buildFooter, buildHeader } from './ui/shell.js'
import { createAdSlot } from './ui/adslot.js'
import { VARIANT_IDS } from './roulette/wheels.js'
import type { VariantId } from './roulette/wheels.js'
import { STRATEGY_IDS, STRATEGY_LABEL } from './sim/strategies.js'
import type { StrategyId } from './sim/strategies.js'
import { EQUITY_SAMPLE_CAP } from './sim/engine.js'
import type { RunResult } from './sim/engine.js'
import { createSimulation } from './sim/client.js'
import { drawBarChart, drawEquityChart } from './sim/charts.js'
import type { EquitySeries } from './sim/charts.js'

/**
 * The strategy simulator page.
 *
 * The framing is the product: this is the page that says a betting system
 * cannot beat a wheel with a zero, and it says it by running the systems
 * rather than by claiming it. The `noZero` wheel is included for the opposite
 * reason, to show what a genuinely fair game looks like, which is that its
 * expected value is zero no matter what the player does.
 */

/**
 * One colour per system, taken from the casino palette already in base.css.
 * Kept here because the chart colours are data: the same system must be the
 * same colour on both charts or the two cannot be read together.
 */
const SERIES_COLOURS: Record<StrategyId, string> = {
  flat: '#8a93b8',
  martingale: '#ffb03a',
  reverseMartingale: '#35c4d9',
  labouchere: '#4ade80',
  fibonacci: '#a78bfa',
  dAlembert: '#f87171',
  oscarGrind: '#f5f2e8',
  columnProgression: '#c9a227',
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += SEED_ALPHABET[byte % SEED_ALPHABET.length]
  return out
}

interface Field {
  readonly label: HTMLElement
  readonly input: HTMLInputElement | HTMLSelectElement
}

function numberField(
  key: TranslationKey,
  value: number,
  attrs: { min?: number; step?: number } = {},
): Field {
  const label = document.createElement('label')
  label.className = 'sim__label'
  const caption = document.createElement('span')
  caption.setAttribute('data-i18n', key)
  const input = document.createElement('input')
  input.className = 'sim__input'
  input.type = 'number'
  input.value = String(value)
  input.inputMode = 'numeric'
  if (attrs.min !== undefined) input.min = String(attrs.min)
  if (attrs.step !== undefined) input.step = String(attrs.step)
  label.append(caption, input)
  return { label, input }
}

function selectField(key: TranslationKey): Field {
  const label = document.createElement('label')
  label.className = 'sim__label'
  const caption = document.createElement('span')
  caption.setAttribute('data-i18n', key)
  const input = document.createElement('select')
  input.className = 'sim__input'
  for (const id of VARIANT_IDS) {
    const option = document.createElement('option')
    option.value = id
    option.setAttribute('data-i18n', `wheel.${id}`)
    input.append(option)
  }
  label.append(caption, input)
  return { label, input }
}

function textField(key: TranslationKey, value: string): Field {
  const label = document.createElement('label')
  label.className = 'sim__label'
  const caption = document.createElement('span')
  caption.setAttribute('data-i18n', key)
  const input = document.createElement('input')
  input.className = 'sim__input'
  input.type = 'text'
  input.value = value
  input.autocapitalize = 'off'
  input.spellcheck = false
  label.append(caption, input)
  return { label, input }
}

function mount(root: HTMLElement): void {
  const variant = selectField('table.variant')
  const bankroll = numberField('sim.bankroll', 1000, { min: 1, step: 100 })
  const spins = numberField('sim.spins', 20000, { min: 0, step: 1000 })
  const tableLimit = numberField('sim.tableLimit', 100, { min: 1, step: 10 })
  const points = numberField('sim.points', 120, { min: 2, step: 1 })
  const seed = textField('sim.seed', randomSeed())

  const strategyGroup = document.createElement('fieldset')
  strategyGroup.className = 'sim__strategies'
  const legend = document.createElement('legend')
  legend.setAttribute('data-i18n', 'sim.strategies')
  strategyGroup.append(legend)

  const boxes = new Map<StrategyId, HTMLInputElement>()
  for (const id of STRATEGY_IDS) {
    const wrapper = document.createElement('label')
    wrapper.className = 'sim__strategy'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = true
    box.value = id
    const caption = document.createElement('span')
    caption.setAttribute('data-i18n', STRATEGY_LABEL[id])
    wrapper.append(box, caption)
    strategyGroup.append(wrapper)
    boxes.set(id, box)
  }

  const bulkRow = document.createElement('div')
  bulkRow.className = 'sim__bulk'
  for (const [key, on] of [
    ['sim.allStrategies', true],
    ['sim.none', false],
  ] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'sim__bulk-button'
    button.setAttribute('data-i18n', key)
    button.addEventListener('click', () => {
      for (const box of boxes.values()) box.checked = on
    })
    bulkRow.append(button)
  }

  const run = document.createElement('button')
  run.type = 'button'
  run.className = 'sim__run'
  run.setAttribute('data-i18n', 'sim.run')

  const controls = document.createElement('div')
  controls.className = 'sim__controls'
  controls.append(variant.label, bankroll.label, spins.label, tableLimit.label, points.label, seed.label)
  const grid = document.createElement('div')
  grid.className = 'sim__grid'
  grid.append(controls)

  const status = document.createElement('p')
  status.className = 'sim__status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const equityCanvas = document.createElement('canvas')
  equityCanvas.className = 'sim__chart'
  equityCanvas.setAttribute('role', 'img')
  const equityCaption = document.createElement('p')
  equityCaption.className = 'sim__caption'
  equityCaption.setAttribute('data-i18n', 'sim.equity')

  const barCanvas = document.createElement('canvas')
  barCanvas.className = 'sim__chart'
  barCanvas.setAttribute('role', 'img')
  const barCaption = document.createElement('p')
  barCaption.className = 'sim__caption'
  barCaption.setAttribute('data-i18n', 'sim.final')

  const body = document.createElement('tbody')
  const table = document.createElement('table')
  table.className = 'sim__table'
  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const key of [
    'sim.strategy',
    'sim.final',
    'sim.ev',
    'sim.roi',
    'sim.drawdown',
    'sim.verdict',
  ] as const) {
    const th = document.createElement('th')
    th.scope = 'col'
    th.setAttribute('data-i18n', key)
    headRow.append(th)
  }
  head.append(headRow)
  table.append(head, body)

  const note = document.createElement('p')
  note.className = 'sim__note'
  note.setAttribute('data-i18n', 'sim.truncated')

  const section = document.createElement('main')
  section.className = 'sim'
  const heading = document.createElement('h1')
  heading.className = 'sim__heading'
  heading.setAttribute('data-i18n', 'h1.simulator')
  section.append(heading, grid, strategyGroup, bulkRow, run, status)
  section.append(equityCaption, equityCanvas)
  section.append(barCaption, barCanvas)
  // The results grid is six numeric columns with nowrap cells, because a number
  // broken across two lines reads as two numbers. Six columns do not fit a 320px
  // screen, so the table scrolls inside its own box rather than widening the
  // page: a sideways-scrolling page on a phone hides the spin control and reads
  // as broken, while a sideways-scrolling table reads as a table with more.
  const tableWrap = document.createElement('div')
  tableWrap.className = 'sim__tablewrap'
  tableWrap.setAttribute('data-i18n-attr', 'aria-label:sim.results')
  tableWrap.append(table)

  section.append(tableWrap, note)

  const slot = createAdSlot()
  root.className = 'shell'
  root.replaceChildren(buildHeader('./simulator.html'), section, slot.element, buildFooter())
  slot.mount()

  const readNumber = (input: HTMLInputElement | HTMLSelectElement, fallback: number): number => {
    const value = Number.parseInt(input.value, 10)
    return Number.isSafeInteger(value) && value >= 0 ? value : fallback
  }

  const selected = (): StrategyId[] =>
    STRATEGY_IDS.filter((id) => boxes.get(id)?.checked === true)

  let lastResults: RunResult[] = []
  let running = false

  function draw(): void {
    const series: EquitySeries[] = lastResults.map((result) => ({
      id: result.strategy,
      colour: SERIES_COLOURS[result.strategy],
      points: result.equity,
    }))
    drawEquityChart(equityCanvas, series)
    drawBarChart(
      barCanvas,
      lastResults.map((result) => ({
        id: result.strategy,
        label: t(STRATEGY_LABEL[result.strategy]),
        value: result.finalBankroll,
        colour: SERIES_COLOURS[result.strategy],
      })),
    )
  }

  function paint(): void {
    body.replaceChildren()
    for (const result of lastResults) {
      const row = document.createElement('tr')
      row.dataset['strategy'] = result.strategy

      const name = document.createElement('th')
      name.scope = 'row'
      name.textContent = t(STRATEGY_LABEL[result.strategy])

      const finalCell = document.createElement('td')
      finalCell.textContent = formatCurrency(result.finalBankroll)

      const evCell = document.createElement('td')
      evCell.textContent = formatCurrency(result.evPerSpin)
      evCell.classList.add('sim__numeric')

      const roiCell = document.createElement('td')
      roiCell.textContent = formatPercent(result.roi, 1)
      roiCell.classList.add('sim__numeric')
      roiCell.classList.add(result.roi < 0 ? 'sim__negative' : 'sim__positive')

      const drawdownCell = document.createElement('td')
      drawdownCell.textContent = formatCurrency(result.maxDrawdown)
      drawdownCell.classList.add('sim__numeric')

      const verdictCell = document.createElement('td')
      // One run either ruined the bankroll or it did not, so ruin is reported
      // as what was observed rather than as a probability this run cannot
      // establish. Establishing the probability is what a hundred runs are for.
      verdictCell.textContent = result.busted
        ? t('sim.busted')
        : t('sim.survived')
      if (result.busted) verdictCell.classList.add('sim__negative')
      else verdictCell.classList.add('sim__positive')

      row.append(name, finalCell, evCell, roiCell, drawdownCell, verdictCell)
      body.append(row)
    }
    note.hidden = !lastResults.some((result) => result.truncated)
  }

  const simulation = createSimulation()
  if (!simulation.offThread) {
    status.textContent = t('sim.mainThread')
  }

  async function execute(): Promise<void> {
    if (running) return
    const strategies = selected()
    if (strategies.length === 0) {
      status.textContent = t('sim.none')
      return
    }
    running = true
    run.disabled = true
    run.setAttribute('data-i18n', 'sim.running')
    applyTranslations(run)
    status.textContent = t('sim.running')

    const requested = readNumber(spins.input, 20000)
    try {
      lastResults = await simulation.run({
        variant: variant.input.value as VariantId,
        spins: requested,
        bankroll: Math.max(1, readNumber(bankroll.input, 1000)),
        minBet: 1,
        maxBet: Math.max(1, readNumber(tableLimit.input, 100)),
        seed: seed.input.value.trim() || randomSeed(),
        samples: Math.min(EQUITY_SAMPLE_CAP, Math.max(2, readNumber(points.input, 120))),
        strategies,
      })
      status.textContent = t('sim.results')
    } catch (error) {
      status.textContent = t('sim.failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      running = false
      run.disabled = false
      run.setAttribute('data-i18n', 'sim.run')
      applyTranslations(run)
      paint()
      draw()
    }
  }

  run.addEventListener('click', () => {
    void execute()
  })

  globalThis.addEventListener('resize', () => {
    if (lastResults.length > 0) draw()
  })

  paint()
}

function boot(): void {
  initI18n()
  const root = document.getElementById('app')
  if (root === null) throw new Error('missing #app mount point')
  mount(root)
  applyTranslations(root)
}

boot()