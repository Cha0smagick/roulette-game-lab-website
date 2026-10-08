/**
 * The English dictionary is the source of truth for the product's vocabulary.
 *
 * `TranslationKey` is derived from this object's shape, so adding a string here
 * immediately requires every locale to provide it. A missing translation is a
 * compile error rather than a blank button discovered in production.
 *
 * Placeholders use {name} and are substituted by `t()`. The `vars` argument is
 * typed from this same shape, so a typo in a placeholder name is also caught.
 */

export const en = {
  // ---- Shell / navigation -------------------------------------------------
  'nav.table': 'Table',
  'nav.simulator': 'Simulator',
  'nav.encyclopedia': 'Encyclopedia',
  'nav.language': 'Language',
  'nav.primary': 'Primary',
  'tagline': 'La publicidad es tu combustible.',

  // ---- Headings -----------------------------------------------------------
  'h1.table': 'Roulette Table',
  'h1.simulator': 'Strategy Simulator',
  'h1.encyclopedia': 'Roulette Encyclopedia',

  // ---- Table controls -----------------------------------------------------
  'table.spin': 'Spin',
  'table.clear': 'Clear bets',
  'table.undo': 'Undo',
  'table.rebet': 'Rebet',
  'table.balance': 'Balance',
  'table.wager': 'Total wager',
  'table.payout': 'Payout',
  'table.net': 'Net',
  'table.seed': 'Seed',
  'table.seedHint': 'Every spin is reproducible from this seed.',
  'table.newSeed': 'New seed',
  'table.variant': 'Wheel',
  'table.history': 'History',
  'table.stats': 'Statistics',
  'table.hot': 'Hot',
  'table.cold': 'Cold',
  'table.streak': 'Streak',
  'table.emptyBoard': 'Select one or more chips, then tap a betting area.',
  'table.tooPoor': 'Not enough balance for that bet.',
  'table.spinning': 'Dealing…',
  'table.resultWin': 'Win {amount}',
  'table.resultLoss': 'No win',
  'table.resultPush': 'Push',
  'table.wheel': 'Roulette wheel',

  // ---- Chips --------------------------------------------------------------
  'chip.select': 'Chip',
  'chip.1': '1',
  'chip.5': '5',
  'chip.25': '25',
  'chip.100': '100',

  // ---- Wheel variants -----------------------------------------------------
  'wheel.noZero': 'No zero (36)',
  'wheel.european': 'European (0)',
  'wheel.american': 'American (0, 00)',
  'wheel.edge': 'House edge {value}',
  'wheel.pockets': 'Pockets',

  // ---- Bet areas ----------------------------------------------------------
  'bet.straight': 'Straight up',
  'bet.split': 'Split',
  'bet.street': 'Street',
  'bet.corner': 'Corner',
  'bet.line': 'Six line',
  'bet.column': 'Column',
  'bet.dozen': 'Dozen',
  'bet.red': 'Red',
  'bet.black': 'Black',
  'bet.odd': 'Odd',
  'bet.even': 'Even',
  'bet.low': '1–18',
  'bet.high': '19–36',
  // The board needs a label that names the covered numbers, because the overlay
  // is a transparent rectangle and its position alone tells a screen reader
  // nothing.
  'bet.streetNumbers': 'Street {numbers}',
  'bet.cornerNumbers': 'Corner {numbers}',
  'bet.lineNumbers': 'Six line {numbers}',
  'board.layers': 'Bet layer',
  'board.layer.street': 'Street',
  'board.layer.corner': 'Corner',
  'board.layer.line': 'Six line',

  // ---- Simulator ----------------------------------------------------------
  'sim.run': 'Run simulation',
  'sim.running': 'Running…',
  'sim.strategies': 'Strategies',
  'sim.spins': 'Spins per strategy',
  'sim.seed': 'Seed',
  'sim.tableLimit': 'Table limit',
  'sim.bankroll': 'Starting bankroll',
  'sim.results': 'Results',
  'sim.strategy': 'Strategy',
  'sim.final': 'Final bankroll',
  'sim.ev': 'EV / spin',
  'sim.roi': 'Return',
  'sim.drawdown': 'Max drawdown',
  'sim.ruin': 'Ruin probability',
  'sim.survived': 'Survived',
  'sim.busted': 'Busted',
  'sim.spinCount': 'spins',
  'sim.equity': 'Bankroll over time',
  'sim.verdict': 'Verdict',
  'sim.truncated': 'Results truncated for display. Full series is in memory only.',
  'sim.strategy.flat': 'Flat',
  'sim.strategy.flatDesc':
    'Bet the same amount every spin. Ignores the result of the previous spin.',
  'sim.strategy.martingale': 'Martingale',
  'sim.strategy.martingaleDesc':
    'Double after every loss, reset after a win. Needs unlimited capital and a table without a limit.',
  'sim.strategy.reverseMartingale': 'Reverse Martingale',
  'sim.strategy.reverseMartingaleDesc':
    'Double after every win, reset after a loss. Risks little, wins rarely.',
  'sim.strategy.labouchere': 'Labouchère',
  'sim.strategy.labouchereDesc':
    'Walk a list of stakes, adding the total after a loss and subtracting it after a win.',
  'sim.strategy.fibonacci': 'Fibonacci',
  'sim.strategy.fibonacciDesc':
    'Step up the Fibonacci sequence after a loss, step down one step after a win.',
  'sim.strategy.dAlembert': "D'Alembert",
  'sim.strategy.dAlembertDesc':
    'Add one unit after a loss, subtract one after a win. A gentler negative progression.',
  'sim.strategy.oscarGrind': 'Oscar Grind',
  'sim.strategy.oscarGrindDesc':
    'Bet one more unit when ahead, one less when behind. Keeps the bet near even money.',
  'sim.strategy.columnProgression': 'Column progression',
  'sim.strategy.columnProgressionDesc':
    'Progressive bet on a column, reverting on a win.',
  'sim.allStrategies': 'Select all',
  'sim.none': 'None',
  'sim.points': 'Equity points',
  'sim.failed': 'The simulation failed: {message}',
  'sim.mainThread': 'Running on the main thread. A long run will freeze the page.',

  // ---- Encyclopedia -------------------------------------------------------
  'ency.intro':
    'This engine does not predict. It measures. The wheel is a physical random process, and no method overcomes it. What follows is the arithmetic, and the simulation results are the arithmetic running.',
  'ency.readMore': 'Read',
  'ency.contents': 'Contents',

  // ---- Shared -------------------------------------------------------------
  'ad.label': 'Advertisement',
  'common.loading': 'Loading…',
  'common.number': 'Number',
  'common.percent': 'Percent',
} as const

export type TranslationKey = keyof typeof en