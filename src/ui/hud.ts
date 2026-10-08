import type { SessionState } from '../game/reducer';
import { SYMBOLS, THREE_OF_A_KIND } from '../game/paytable';
import type { WinTier } from '../game/types';

/**
 * HUD: energy, credits, jackpot, streak, and the always-visible count of spins
 * until the next ad break.
 *
 * The break counter is not decoration. A commercial break that arrives
 * unannounced reads as the game hijacking the session, and players who feel
 * ambushed leave. Announcing it costs nothing and is the difference between a
 * break that feels like fuel and one that feels like an ad.
 */

export interface HudElements {
  energy: HTMLElement;
  credits: HTMLElement;
  jackpot: HTMLElement;
  streak: HTMLElement;
  spinButton: HTMLButtonElement;
  betControls: HTMLButtonElement[];
  message: HTMLElement;
  paytable: HTMLElement;
  breakCounter: HTMLElement;
}

const TIER_LABEL: Readonly<Record<WinTier, string>> = {
  none: '',
  small: 'Pequena victoria',
  medium: 'Buena victoria',
  large: 'Gran victoria',
  jackpot: 'JACKPOT',
};

export function createHud(root: HTMLElement): HudElements {
  root.innerHTML = '';

  const jackpot = div('stat stat--jackpot');
  jackpot.append(label('Jackpot'), value('0', 'hud__jackpot'));

  const credits = div('stat');
  credits.append(label('Creditos'), value('0', 'hud__credits'));

  const energy = div('stat stat--energy');
  energy.append(label('Energia'), value('0', 'hud__energy'));

  const streak = div('stat');
  streak.append(label('Racha'), value('0', 'hud__streak'));

  const breakCounter = div('break-countdown');
  const message = div('message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');

  const betControls: HTMLButtonElement[] = [1, 2, 3].map((bet) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bet';
    button.textContent = `${bet}`;
    button.dataset.bet = String(bet);
    button.setAttribute('aria-label', `Apostar ${bet} de energia`);
    return button;
  });

  const spinButton = document.createElement('button');
  spinButton.type = 'button';
  spinButton.className = 'spin';
  spinButton.textContent = 'GIRAR';

  const paytable = buildPaytable();

  root.append(jackpot, credits, energy, streak, paytable, breakCounter, message);

  const betRow = div('bet-row');
  betRow.append(label('Apuesta'));
  for (const b of betControls) {
    betRow.append(b);
  }
  root.append(betRow, spinButton);

  return {
    energy: requireEl(energy.querySelector('.stat__value')),
    credits: requireEl(credits.querySelector('.stat__value')),
    jackpot: requireEl(jackpot.querySelector('.stat__value')),
    streak: requireEl(streak.querySelector('.stat__value')),
    spinButton,
    betControls,
    message,
    paytable,
    breakCounter,
  };
}

/**
 * Builds the in-game paytable from the same constants the spin resolver uses.
 * Rendering it is what separates a game from a scam: the player can see exactly
 * what a win pays and how likely it is.
 */
function buildPaytable(): HTMLElement {
  const table = document.createElement('div');
  table.className = 'paytable';

  const heading = document.createElement('h2');
  heading.className = 'paytable__title';
  heading.textContent = 'Tabla de premios';
  table.append(heading);

  const list = document.createElement('ul');
  list.className = 'paytable__list';

  // Reverse order so the rarest, richest symbol reads first, as on a real
  // machine. Order is derived from the paytable, never hardcoded.
  const ordered = [...SYMBOLS].sort((a, b) => b.weight - a.weight);
  for (const symbol of ordered) {
    const item = document.createElement('li');
    item.className = 'paytable__row';

    const swatch = document.createElement('span');
    swatch.className = 'paytable__symbol';
    swatch.style.color = symbol.color;
    swatch.textContent = symbol.label;

    const pay = document.createElement('span');
    pay.className = 'paytable__pay';

    // Reads the payout straight off the imported table, so the screen cannot
    // drift from the maths the reels actually use.
    pay.textContent = `x${THREE_OF_A_KIND[symbol.id] ?? 0}`;

    const odds = document.createElement('span');
    odds.className = 'paytable__odds';
    odds.textContent = `${((symbol.weight / totalWeight()) * 100).toFixed(0)}% por casilla`;

    item.append(swatch, pay, odds);
    list.append(item);
  }

  table.append(list);
  return table;
}

function totalWeight(): number {
  return SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function label(text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'stat__label';
  el.textContent = text;
  return el;
}

function value(text: string, className: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = `stat__value ${className}`;
  el.textContent = text;
  return el;
}

function requireEl<T extends Element>(found: T | null): T {
  if (found === null) {
    throw new Error('HUD element missing after construction');
  }
  return found;
}

/** Pushes state into the DOM. Called once per state transition, not per frame. */
export function renderHud(elements: HudElements, state: SessionState, spinsToBreak: number): void {
  elements.energy.textContent = String(state.energy);
  elements.credits.textContent = String(state.credits);
  elements.jackpot.textContent = String(state.jackpot.amount);
  elements.streak.textContent = String(state.streak);

  for (const button of elements.betControls) {
    const value = Number(button.dataset.bet ?? '1');
    button.classList.toggle('bet--active', value === state.bet);
    button.setAttribute('aria-pressed', String(value === state.bet));
  }

  const canSpin = state.energy >= state.bet && state.credits >= state.bet;
  elements.spinButton.disabled = !canSpin;

  elements.breakCounter.textContent =
    spinsToBreak <= 0 ? ' proxima pausa publicitaria: ahora' : ` pausa publicitaria en ${spinsToBreak} giros`;

  const outcome = state.lastOutcome;
  if (outcome === null) {
    elements.message.textContent = 'Mira un anuncio para obtener energia y girar.';
  } else if (outcome.tier !== 'none') {
    elements.message.textContent = `${TIER_LABEL[outcome.tier]} +${outcome.payoutMultiplier}`;
  } else if (outcome.payoutMultiplier > 0) {
    // A pair pays but is not promoted to a tier, and the copy says so plainly
    // rather than dressing it as a win.
    elements.message.textContent = `Par +${outcome.payoutMultiplier}`;
  } else if (outcome.nearMiss) {
    elements.message.textContent = 'Casi...';
  } else {
    elements.message.textContent = 'Sin premio esta vez.';
  }
}