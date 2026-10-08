/**
 * The betting board.
 *
 * Geometry. Number n (1..36) sits at grid column (n - 1) % 3, grid row
 * floor((n - 1) / 3), which is how the felt is printed: three streets per row,
 * bottom row is 1, 2, 3. Zeros sit in their own column to the left of the grid,
 * because on a real layout they are a separate pocket and, on the American
 * wheel, there are two of them.
 *
 * Corners and lines are the hard part on a phone. A corner covers four numbers
 * and a line covers six, so they cannot be extra cells in the grid without
 * pushing every number below a legible size at 320px. Instead each is an
 * absolutely positioned overlay that spans a rectangle of the grid, drawn as a
 * brass outline over the numbers it covers and transparent in the middle, so
 * the number grid stays readable underneath.
 *
 * Overlays of different kinds overlap each other, so they cannot all be live
 * at once. A layer toggle picks which one is armed; the number grid itself
 * always stays live for straight-up bets, because the numbers are what a
 * player reads to decide anything.
 *
 * Splits get no overlay. There are 57 of them on a 3x12 grid, they would bury
 * the grid under a thicket of thin buttons, and no overlap-free rectangle
 * represents "any two adjacent numbers". Instead a split is placed by arming
 * one number and then tapping its neighbour.
 */

import type { BetPlacement } from '../roulette/bets.js'
import { betOn, type TableState } from '../game/table.js'
import { colourOf, type Pocket, type VariantId } from '../roulette/wheels.js'
import { t } from '../i18n/index.js'

/** Which family of overlay bets is currently armed. */
export type BetLayer = 'street' | 'corner' | 'line'

export interface Board {
  readonly element: HTMLElement
  /** Repaint chip markers and affordances after a state change. */
  render(state: TableState): void
}

/** Cell coordinates of a pocket in the 3-wide grid. */
function cellOf(pocket: Pocket): { column: number; row: number } {
  return { column: (pocket - 1) % 3, row: Math.floor((pocket - 1) / 3) }
}

/**
 * True when two pockets form a legal split.
 *
 * Note that this cannot express 0|00. The engine models the double zero as the
 * same value 0 distinguished only by position, so `covers` sees a straight-up
 * on 0 as covering both American zero pockets and there is no way to name one
 * of them. Offering that split would print a button whose result the engine
 * could not compute, so it is left out rather than faked.
 */
export function isSplitPair(a: Pocket, b: Pocket): boolean {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  if (low === 0) {
    // 0 splits with the first street only; that is where it touches the layout.
    return high >= 1 && high <= 3;
  }
  if (high <= 36) {
    const withinStreet = Math.floor((low - 1) / 3) === Math.floor((high - 1) / 3);
    if (withinStreet) {
      return high - low === 1;
    }
    return high - low === 3 && (low - 1) % 3 === (high - 1) % 3;
  }
  return false;
}

/** One overlay bet: a rectangle of the grid and the numbers inside it. */
export interface OverlayPlacement {
  readonly kind: BetLayer
  readonly numbers: readonly Pocket[]
}

/** The accessible name of each overlay family, naming the numbers it covers. */
const OVERLAY_LABEL_KEY = {
  street: 'bet.streetNumbers',
  corner: 'bet.cornerNumbers',
  line: 'bet.lineNumbers',
} as const satisfies Record<BetLayer, Parameters<typeof t>[0]>

/**
 * Every street, corner and six line the board offers, as pure data.
 *
 * This is the single source of the board geometry, so the counts (12 streets,
 * 22 corners, 11 lines) are asserted in tests rather than implied by a loop.
 */
export function overlayPlacements(): OverlayPlacement[] {
  const out: OverlayPlacement[] = [];
  for (let row = 0; row < 12; row += 1) {
    const first = row * 3 + 1;
    out.push({ kind: 'street', numbers: [first, first + 1, first + 2] });
  }
  for (let row = 0; row < 11; row += 1) {
    const first = row * 3 + 1;
    // Two corner blocks per row: the left pair of columns and the right pair.
    // Expressed as offsets from the first number of the row, because walking a
    // "column index" and adding it to both rows of the block overruns the felt
    // at the bottom -- the right-hand block of the last row reached 37.
    out.push({ kind: 'corner', numbers: [first, first + 1, first + 3, first + 4] });
    out.push({ kind: 'corner', numbers: [first + 1, first + 2, first + 4, first + 5] });
  }
  for (let row = 0; row < 11; row += 1) {
    const first = row * 3 + 1;
    out.push({
      kind: 'line',
      numbers: [first, first + 1, first + 2, first + 3, first + 4, first + 5],
    });
  }
  return out;
}

function numbersLabel(numbers: readonly Pocket[]): string {
  return numbers.slice().sort((a, b) => a - b).join(', ');
}

export function createBoard(
  variant: VariantId,
  onPlace: (placement: BetPlacement) => void,
): Board {
  const root = document.createElement('div');
  root.className = 'board';

  // --- layer toggle ------------------------------------------------------
  const layerRow = document.createElement('div');
  layerRow.className = 'board__layers';
  layerRow.setAttribute('role', 'group');
  layerRow.setAttribute('aria-label', t('board.layers'));

  // --- number grid -------------------------------------------------------
  const grid = document.createElement('div');
  grid.className = 'board__grid';
  // The zeros are the first column of the grid, not a sibling block. That is
  // what lets the overlay layer reuse the identical column template: an overlay
  // span expressed in the same coordinates as a number therefore lands on the
  // numbers it covers, with no second geometry to keep in sync.
  if (variant !== 'noZero') {
    grid.classList.add('board__grid--with-zero');
  }
  const columnOffset = variant === 'noZero' ? 1 : 2;

  const numberButtons = new Map<Pocket, HTMLButtonElement>();
  for (let pocket = 1; pocket <= 36; pocket += 1) {
    const at = cellOf(pocket);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'board__number';
    button.style.gridColumn = String(at.column + columnOffset);
    button.style.gridRow = String(at.row + 1);
    button.dataset['colour'] = colourOf(pocket);
    // A printed number is not translatable copy, so it is not an i18n string.
    button.textContent = String(pocket); // i18n-exempt: pocket number as printed on felt
    button.addEventListener('click', () => {
      onArmed(pocket);
    });
    numberButtons.set(pocket, button);
    grid.append(button);
  }

  // --- zeros -------------------------------------------------------------
  const zeroLabels = variant === 'american' ? ['0', '00'] : ['0'];
  const zeroButtons: HTMLButtonElement[] = [];
  for (const [index, label] of zeroLabels.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'board__number board__number--zero';
    button.dataset['colour'] = 'green';
    button.textContent = label; // i18n-exempt: zero printed as on felt
    button.style.gridColumn = '1';
    // A lone zero owns the whole column height; a pair splits it between them,
    // which is what the American layout looks like.
    const rowsPerZero = zeroLabels.length === 1 ? 12 : 6;
    button.style.gridRow = `${index * rowsPerZero + 1} / span ${rowsPerZero}`;
    button.addEventListener('click', () => {
      onArmed(0);
    });
    zeroButtons.push(button);
    grid.append(button);
  }

  // --- overlays ----------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.className = 'board__overlays';
  overlay.dataset['layer'] = 'street';

  interface Overlay {
    readonly button: HTMLButtonElement;
    readonly placement: BetPlacement;
    readonly kind: BetLayer;
  }
  const overlays: Overlay[] = [];

  const addOverlay = (
    kind: BetLayer,
    numbers: readonly Pocket[],
    labelKey: Parameters<typeof t>[0],
  ): void => {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const first = cellOf(sorted[0] as Pocket);
    const last = cellOf(sorted[sorted.length - 1] as Pocket);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `board__overlay board__overlay--${kind}`;
    button.style.gridColumn = `${first.column + columnOffset} / span ${last.column - first.column + 1}`;
    button.style.gridRow = `${first.row + 1} / span ${last.row - first.row + 1}`;
    button.setAttribute('aria-label', t(labelKey, { numbers: numbersLabel(sorted) }));
    const placement: BetPlacement = { kind, numbers: sorted };
    button.addEventListener('click', () => {
      onPlace(placement);
    });
    overlay.append(button);
    overlays.push({ button, placement, kind });
  };

  // Streets: 12 rows of three. Corners: 22 blocks of 2x2. Lines: 11 blocks of
  // 2 rows by 3 columns. The geometry is a pure function so the counts can be
  // asserted in test/table.test.ts and the DOM only has to place what it returns.
  for (const entry of overlayPlacements()) {
    addOverlay(entry.kind, entry.numbers, OVERLAY_LABEL_KEY[entry.kind]);
  }

  // --- outside bets ------------------------------------------------------
  const outsideRow = document.createElement('div');
  outsideRow.className = 'board__outside';
  const outsideKinds = [
    'dozen',
    'dozen',
    'dozen',
    'column',
    'column',
    'column',
    'low',
    'even',
    'red',
    'black',
    'odd',
    'high',
  ] as const;
  const outsideCells: { button: HTMLButtonElement; placement: BetPlacement }[] = [];
  for (const [index, kind] of outsideKinds.entries()) {
    const group = index < 6 ? (index % 3) + 1 : undefined;
    const placement: BetPlacement = group === undefined ? { kind } : { kind, group };
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'board__outside-bet';
    button.setAttribute('data-i18n', `bet.${kind}`);
    button.addEventListener('click', () => {
      onPlace(placement);
    });
    outsideRow.append(button);
    outsideCells.push({ button, placement });
  }

  // --- split arming ------------------------------------------------------
  // Arm one pocket, then tap its neighbour. The armed pocket is marked on the
  // number itself so the pairing is visible, not just narrated.
  let armed: Pocket | null = null;
  let lastState: TableState | null = null;

  function repaint(): void {
    if (lastState !== null) {
      render(lastState);
    }
  }

  function onArmed(pocket: Pocket): void {
    if (armed === null) {
      armed = pocket;
    } else if (armed === pocket) {
      // Tapping the armed number again is a straight-up, which is what the
      // player means when they change their mind about the pair.
      armed = null;
      onPlace({ kind: 'straight', numbers: [pocket] });
    } else if (isSplitPair(armed, pocket)) {
      onPlace({ kind: 'split', numbers: [armed, pocket] });
      armed = null;
    } else {
      // Not adjacent: treat the new tap as the new first number rather than
      // refusing silently, because a silent no-op on a phone reads as a bug.
      armed = pocket;
    }
    repaint();
  }

  const layerButtons = new Map<BetLayer, HTMLButtonElement>();
  for (const layer of ['street', 'corner', 'line'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'board__layer';
    button.setAttribute('data-i18n', `board.layer.${layer}`);
    button.addEventListener('click', () => {
      overlay.dataset['layer'] = layer;
      armed = null;
      repaint();
    });
    layerButtons.set(layer, button);
    layerRow.append(button);
  }

  // The felt wraps the grid and the overlay layer together and nothing else, so
  // that the overlay's absolute inset covers exactly the grid it mirrors.
  const felt = document.createElement('div');
  felt.className = 'board__felt';
  felt.append(grid, overlay);

  root.append(layerRow, felt, outsideRow);

  // Declared as a function, not as a method on the returned object, so that the
  // click handlers above can call it. A method literal has no binding in scope
  // for its siblings to reference.
  function render(state: TableState): void {
    lastState = state;
    const canStake = state.balance >= state.chip;

    for (const [pocket, button] of numberButtons) {
      const bet = betOn(state, { kind: 'straight', numbers: [pocket] });
      button.classList.toggle('board__number--staked', bet !== null);
      button.classList.toggle('board__number--armed', armed === pocket);
      button.setAttribute('aria-pressed', armed === pocket ? 'true' : 'false');
      button.disabled = !canStake;
    }
    for (const button of zeroButtons) {
      button.classList.toggle('board__number--armed', armed === 0);
      button.disabled = !canStake;
    }

    const active = overlay.dataset['layer'] as BetLayer;
    for (const entry of overlays) {
      const live = entry.kind === active;
      entry.button.hidden = !live;
      entry.button.disabled = !live || !canStake;
      entry.button.classList.toggle(
        'board__overlay--staked',
        live && betOn(state, entry.placement) !== null,
      );
    }
    for (const [layer, button] of layerButtons) {
      button.setAttribute('aria-pressed', layer === active ? 'true' : 'false');
    }

    for (const cell of outsideCells) {
      cell.button.disabled = !canStake;
      cell.button.classList.toggle(
        'board__outside-bet--staked',
        betOn(state, cell.placement) !== null,
      );
    }
  }

  return { element: root, render };
}