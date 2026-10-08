import './styles/base.css'
import './styles/wheel.css'
import './styles/board.css'
import './styles/hud.css'
import './styles/adslot.css'
import {
  applyTranslations,
  formatCurrency,
  initI18n,
  t,
} from './i18n/index.js'
import type { TranslationKey } from './i18n/index.js'
import { buildFooter, buildHeader } from './ui/shell.js'
import { EUROPEAN, pickPocket, type Pocket } from './roulette/wheels.js'
import { createWheelRenderer } from './ui/wheel.js'
import type { WheelRenderer } from './ui/wheel.js'
import { createBoard, type Board } from './ui/board.js'
import { createChipPicker, type ChipPicker } from './ui/chips.js'
import { createHistoryStrip } from './ui/history.js'
import { loadHistory, recordOutcome } from './ui/history-store.js'
import type { History } from './roulette/history.js'
import { createAdSlot } from './ui/adslot.js'
import { boot } from './ui/boot.js'
import {
  INITIAL_TABLE,
  hasBets,
  pendingWager,
  reduce,
  type TableState,
} from './game/table.js'
import { nextAutoplayAction } from './game/autoplay.js'
import { createRng, type Rng } from './util/rng.js'

/** The three pages this site ships live in the shared shell. */

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Milliseconds between autoplay ticks: slower than a spin, faster than a reader waits. */
const AUTOPLAY_TICK_MS = 400

/** A short, human-readable seed so a session can be replayed from the console. */
function newSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += SEED_ALPHABET[byte % SEED_ALPHABET.length]
  }
  return out
}

interface Stat {
  readonly label: string
  readonly value: HTMLElement
}

function buildStat(key: TranslationKey): Stat {
  const wrap = document.createElement('div')
  wrap.className = 'hud__stat'
  const label = document.createElement('span')
  label.className = 'hud__stat-label'
  label.setAttribute('data-i18n', key)
  const value = document.createElement('span')
  value.className = 'hud__stat-value'
  wrap.append(label, value)
  return { label: key, value }
}

function buildButton(
  key: TranslationKey,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.setAttribute('data-i18n', key)
  button.addEventListener('click', onClick)
  return button
}

/**
 * The live table: wheel, betting board, chips and the settlement readouts.
 *
 * The wheel is a pure view -- it is told which pocket to land on and reports
 * back only whether a spin is still in flight. It never picks a number itself.
 * `pickPocket` in roulette/wheels owns every draw, so the renderer cannot
 * become a second, disagreeing source of randomness, and the seed printed
 * beside the balance replays the whole session.
 */
function buildTable(): { section: HTMLElement; wheel: WheelRenderer } {
  let state: TableState = INITIAL_TABLE
  let seed = newSeed()
  let rng: Rng = createRng(seed)
  let spins = 0
  let history: History = loadHistory()
  let autoplaying = false
  let autoplayTimer: number | undefined

  const section = document.createElement('main')
  section.className = 'table'

  const canvas = document.createElement('canvas')
  canvas.className = 'wheel'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', t('table.wheel'))
  section.append(canvas)
  const wheel = createWheelRenderer(canvas, EUROPEAN)

  // Directly under the wheel, because a strip of history next to the thing that
  // produced it is the pairing that makes it checkable. It records spins and
  // nothing else: no repeats are highlighted and nothing is marked as due.
  const strip = createHistoryStrip()
  strip.render(history)
  section.append(strip.element)

  const balance = buildStat('table.balance')
  const wager = buildStat('table.wager')
  const payout = buildStat('table.payout')
  const net = buildStat('table.net')
  const stats = document.createElement('div')
  stats.className = 'hud__stats'
  stats.append(balance.value, wager.value, payout.value, net.value)

  const chips: ChipPicker = createChipPicker((chip) => {
    dispatch({ type: 'set-chip', chip })
  })
  const board: Board = createBoard(EUROPEAN.id, (placement) => {
    dispatch({ type: 'place', placement })
  })

  const result = document.createElement('p')
  result.className = 'hud__result'
  // The outcome of a spin is the single most important event on the page and it
  // is visual only -- the wheel turning is not something a screen reader can
  // describe -- so it is announced here instead.
  result.setAttribute('role', 'status')
  result.setAttribute('aria-live', 'polite')

  const spinButton = buildButton('table.spin', 'controls__spin', () => {
    spin()
  })
  const clearButton = buildButton('table.clear', 'controls__small', () => {
    dispatch({ type: 'clear' })
  })
  const undoButton = buildButton('table.undo', 'controls__small', () => {
    dispatch({ type: 'undo' })
  })
  const rebetButton = buildButton('table.rebet', 'controls__small', () => {
    dispatch({ type: 'rebet' })
  })
  const autoplayButton = buildButton('table.autoplay', 'controls__small', () => {
    if (autoplaying) {
      stopAutoplay()
    } else {
      startAutoplay()
    }
  })
  // Reload is the natural reset, but a button keeps it one tap, and it ends any
  // autoplay loop first: a reset that left the interval running would
  // immediately re-place the settled bets the player just cleared.
  const resetButton = buildButton('table.reset', 'controls__small', () => {
    stopAutoplay()
    dispatch({ type: 'reset' })
  })
  const seedRow = document.createElement('div')
  seedRow.className = 'hud__seed'
  const seedLabel = document.createElement('span')
  seedLabel.setAttribute('data-i18n', 'table.seed')
  const seedValue = document.createElement('code')
  seedValue.className = 'hud__seed-value'
  const newSeedButton = buildButton('table.newSeed', 'controls__small', () => {
    seed = newSeed()
    rng = createRng(seed)
    spins = 0
    render()
  })
  seedRow.append(seedLabel, seedValue, newSeedButton)

  const controls = document.createElement('div')
  controls.className = 'controls'
  controls.append(chips.element, spinButton)
  const small = document.createElement('div')
  small.className = 'controls__row'
  small.append(clearButton, undoButton, rebetButton, autoplayButton, resetButton)
  controls.append(small)

  section.append(board.element, controls, stats, result, seedRow)

  function dispatch(action: Parameters<typeof reduce>[1]): void {
    const next = reduce(state, action)
    // A rejected action returns the identical object, which is how the caller
    // knows there is nothing to repaint.
    if (next !== state) {
      state = next
      render()
    }
  }

  function describe(pocket: Pocket): void {
    const settled = state.lastSettlement
    if (settled === null) {
      return
    }
    const label = `${String(pocket)}, `
    result.textContent =
      settled.net > 0
        ? label + t('table.resultWin', { amount: formatCurrency(settled.net) })
        : label + t('table.resultLoss')
  }

  function spin(): void {
    if (wheel.isSpinning() || !hasBets(state)) {
      return
    }
    const pocket = pickPocket(EUROPEAN, (max) => rng.int(max))
    const index = EUROPEAN.pockets.indexOf(pocket)
    wheel.spinTo(index)
    spins += 1
    dispatch({ type: 'spin', outcome: pocket })
    describe(pocket)
    history = recordOutcome(history, pocket)
    strip.render(history)
  }

  // The autoplay loop runs the pure decision once per tick and dispatches what
  // it returns. It never stakes what the balance does not hold: the `stop`
  // branch is the honest answer when the repeat would overdraw, exactly the
  // rule the rebet reducer enforces.
  function autoplayLabel(): void {
    const key = autoplaying ? 'table.autoplayStop' : 'table.autoplay'
    autoplayButton.setAttribute('data-i18n', key)
    autoplayButton.textContent = t(key)
    autoplayButton.setAttribute('aria-pressed', String(autoplaying))
  }

  function stopAutoplay(): void {
    autoplaying = false
    if (autoplayTimer !== undefined) {
      window.clearInterval(autoplayTimer)
      autoplayTimer = undefined
    }
    autoplayLabel()
    render()
  }

  function startAutoplay(): void {
    autoplaying = true
    autoplayLabel()
    autoplayTimer = window.setInterval(() => {
      const action = nextAutoplayAction(state, wheel.isSpinning())
      if (action === 'wait') return
      if (action === 'stop') {
        stopAutoplay()
        return
      }
      if (action === 'rebet') {
        dispatch({ type: 'rebet' })
        return
      }
      spin()
    }, AUTOPLAY_TICK_MS)
  }

  function render(): void {
    const settled = state.lastSettlement
    balance.value.textContent = formatCurrency(state.balance)
    wager.value.textContent = formatCurrency(pendingWager(state))
    payout.value.textContent =
      settled === null ? formatCurrency(0) : formatCurrency(settled.returned)
    net.value.textContent =
      settled === null ? formatCurrency(0) : formatCurrency(settled.net)
    net.value.classList.toggle('hud__stat-value--negative', settled !== null && settled.net < 0)
    net.value.classList.toggle('hud__stat-value--positive', settled !== null && settled.net > 0)
    seedValue.textContent = `${seed} / ${String(spins)}` // i18n-exempt: seed and spin count are data, not copy
    chips.render(state.chip, state.balance)
    board.render(state)
    spinButton.disabled = wheel.isSpinning() || !hasBets(state)
    const canUndo = state.bets.length > 0
    undoButton.disabled = !canUndo
    clearButton.disabled = !canUndo
    rebetButton.disabled = state.lastBets.length === 0
    // The loop can start whenever there is something to repeat or bets on the
    // felt, and it stays clickable while a spin turns so the player can stop
    // the next one before it starts.
    autoplayButton.disabled = !hasBets(state) && state.lastBets.length === 0
    // Every state change passes through here, so this is the one place the gate
    // has to be consulted. It is cheap and one-way: after the unit is in the
    // document the call does nothing at all.
    idleSlot.sync()
  }

  // The table page carries an idle-gated unit as well as the footer one. The
  // gate is the whole point of it: no ad on arrival, none while a spin is
  // turning, none while a bet is staked. An advertisement that appears under a
  // finger is a misdirected tap, and a misdirected tap is how an ad account
  // gets closed.
  const idleSlot = createAdSlot({
    placement: 'idle',
    isIdle: () => spins > 0 && !wheel.isSpinning() && !hasBets(state) && !autoplaying,
  })
  section.append(idleSlot.element)

  section.dataset['spins'] = '0'
  render()
  return { section, wheel }
}

function mount(root: HTMLElement): void {
  const table = buildTable()
  const slot = createAdSlot({ placement: 'footer' })
  root.className = 'shell'
  root.replaceChildren(buildHeader('./'), table.section, slot.element, buildFooter())

  // Synced last, after the table is in the document and interactive. The ad is
  // a passive third-party iframe, so there is nothing to coordinate with it, but
  // ordering it last keeps the first interaction budget spent on the game rather
  // than on whatever the network was doing when the page opened.
  slot.sync()

  // Exposed on the root purely so the browser console can audit a landed number
  // against the printed seed instead of trusting the pixels.
  const audit = root as HTMLElement & { rouletteLabWheel?: WheelRenderer }
  audit.rouletteLabWheel = table.wheel
}

boot('app', (root) => {
  initI18n()
  mount(root)
  applyTranslations(root)
})