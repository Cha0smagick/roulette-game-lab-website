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
  'ency.col.variant': 'Variant',
  'ency.col.edge': 'House edge',
  'ency.col.rtp': 'Return to player',
  'ency.col.bet': 'Bet',
  'ency.col.payout': 'Payout',
  'ency.col.covers': 'Numbers covered',

  // ---- Encyclopedia articles ----
  // Keyed as art.<articleId>.<part>. src/content/index.ts extracts the union of
  // these keys from this dictionary, so a registry entry naming a key that does
  // not exist here fails the build instead of rendering an empty heading.
  'art.wheels.title': 'The three wheels',
  'art.wheels.summary':
    'A roulette wheel is a bag of outcomes with a particular distribution, and the three variants differ only in what else is in the bag. Everything else on this page follows from that one fact.',
  'art.wheels.layout':
    'The numbers 1 to 36 appear once each on every wheel. What changes is the zero. The no-zero wheel has no zero at all and pays even money on every bet, so it is a fair game: the expected return of any bet is exactly the amount staked. The European wheel adds a single zero, and the American wheel adds a second zero printed as 00. Those zeros are the entire difference between a wheel that costs the player nothing and a wheel that takes a small percentage of every wager.',
  'art.wheels.green':
    'Zero and, on the American wheel, 00 are coloured green rather than red or black. That is not decoration. Red and black are even-money bets, and a green pocket wins neither of them, which is exactly how a zero extracts the house edge from bets that look symmetric. On the American wheel both zero pockets lose the same bets, which is why its edge is larger than the European wheel’s.',
  'art.wheels.ordering':
    'The order of the numbers around a real wheel is deliberately irregular, so no sequence of neighbours carries information. This engine stores the genuine clockwise order of each wheel rather than sorting 1 to 36, because a sorted layout would make neighbouring numbers look meaningful when they are not.',

  'art.bets.title': 'The fourteen bets',
  'art.bets.summary':
    'A bet is a statement about which pockets would win. Roulette has fourteen standard forms of that statement, and they differ enormously in how likely they are to win and how much they pay when they do. The table below is generated from the same constants the game plays with, so it cannot go stale.',
  'art.bets.payout':
    'The payout shown for each bet is profit per unit staked, not the total returned. A straight-up on a single number pays 35 to 1, so a stake of 1 returns 36 when it wins: the 35 of profit plus the 1 staked. Reading the figure as 35 returned instead of 35 won is the most common misreading of any roulette payout table, and it makes the bet look much worse than it is.',
  'art.bets.coverage':
    'The coverage column is the number of pockets that make the bet win, and it is the denominator of the probability. A straight-up covers 1 pocket out of 37 on a single-zero wheel, which is why it pays so much. Red covers 18. The even-money bets and the dozens and columns all cover 12 or 18, which is why they pay 1 to 1 and 2 to 1 respectively.',
  'art.bets.stake':
    'Stakes stack. Placing a second chip on a bet already covered by one of yours adds to it rather than replacing it, and the combined wager settles as a single bet paying at that bet’s rate. There is no advantage to splitting the same money across several bets: the expected return per unit staked is identical either way, so splitting only makes the outcome noisier.',

  'art.edge.title': 'Where the house edge comes from',
  'art.edge.summary':
    'The house edge is not a hidden adjustment applied to your winnings. It is the arithmetic consequence of the zeros, and it is the same on every bet and every wheel.',
  'art.edge.zero':
    'An even-money bet wins on 18 pockets, loses on 18, and either ties or loses on the zero. On a single-zero wheel that is 18 wins against 19 losses. Because every win returns one unit of profit and every loss costs one unit, the expected result per spin is 18/37 of a unit won against 19/37 lost, which is a loss of one unit in 37 — the 2.70 percent edge of the European wheel. On the American wheel the same calculation runs 18 against 20, giving one unit in 38, the 5.26 percent edge. On a wheel with no zero it runs 18 against 18, and the edge is exactly nothing.',
  'art.edge.uniformity':
    'A bet on a dozen or a column covers 12 pockets and pays 2 to 1, so it wins 12 times and loses 24 on a single-zero wheel. Twelve wins at two units against 24 losses at one unit is exactly 24 units in each direction, and the zero is what makes the two sides unequal rather than the coverage. This is why the edge does not vary between inside bets and outside bets.',
  'art.edge.same':
    'Every bet on a given wheel has the same expected loss per unit staked, whether it is a straight-up paying 35 to 1 or a red paying 1 to 1. A test in this project asserts that to ten decimal places across all fourteen bets. No combination of bets can beat the edge, because each one carries it independently and adding them adds the edges rather than cancelling them.',

  'art.systems.title': 'Progression systems, and what they do',
  'art.systems.summary':
    'A progression system changes how much you stake after each result. It cannot change what the wheel does. Here are eight of the best known, what each one actually does, and why all eight lose.',
  'art.systems.advance':
    'A progression decides the stake for spin n from the results of spins before it. That is a rule about your own bankroll, and the wheel has no access to it. The result is that the sequence of spins the system reacts to is the same sequence an unreactive player would see; only the stakes attached to it have changed. Since the edge applies per unit staked, changing the stakes changes how fast it is paid, not whether it is paid.',
  'art.systems.bankroll':
    'What a progression does change is the distribution of outcomes. Martingale and its relatives stake an amount that grows with the loss streak, so the common outcome is a small win and the rare outcome is a total loss of the bankroll. The expected value of the sequence is unchanged and negative. What is altered is the shape of the risk: the average session ends in a gain, and a minority of sessions end with nothing, which is a harder pattern to notice from the inside than a steady grind downward.',
  'art.systems.verdict':
    'A table limit caps the stake, and every progression except flat betting eventually hits it. A progression that cannot grow has stopped being a progression; it is flat betting with extra steps. This is not a casino convention invented to frustrate players. Any finite bankroll meets a finite limit sooner or later, and the limit only decides when the arithmetic finishes.',

  'art.fallacy.title': 'Independence, streaks and fairness',
  'art.fallacy.summary':
    'The most common way to lose money at roulette is not a bad system. It is a wrong model of what the wheel is doing.',
  'art.fallacy.independence':
    'Each spin is independent of the ones before it. The wheel has no memory of red having come up nine times, and no obligation to make black more likely because of it. Every number on the wheel is equally likely on every spin regardless of what came before, which is the only reason the house edge is constant and the only reason no pattern can be exploited.',
  'art.fallacy.streaks':
    'Streaks occur because streaks must. Run lengths are geometric: on a fair coin the chance that the same side comes up three times is one in four, and the chance that some streak of five or more appears somewhere in a few hundred spins is close to certain. A streak is evidence that the wheel is random, not evidence that a streak has ended and the next spin must compensate.',
  'art.fallacy.fairness':
    'A wheel does not become due. After ten reds, the eleventh spin is still 18/37 red on a single-zero wheel. Expectation describes a long run of spins, not the next one, and any strategy that treats the short run as if it must resemble the long run is describing a different game from the one being played.',

  'art.measurement.title': 'How this engine measures',
  'art.measurement.summary':
    'Nothing on this site is claimed without being computed. The tables, the edges and the simulation results are all produced by running the same code that plays the game.',
  'art.measurement.derived':
    'The house edge shown in the table above is derived by enumerating every pocket on the wheel through each bet and averaging the result, not read from a constant. The number printed is the number the code produced. This matters because a declared edge is only as trustworthy as whoever declared it, and a derived one cannot disagree with the bets it describes.',
  'art.measurement.seeded':
    'The random generator is seeded, and the seed is displayed. A session can therefore be replayed exactly: the same seed and the same spin count produce the same numbers, so any result on this site can be checked rather than taken on trust. In the simulator each system is given its own stream derived from the seed, so changing one system’s spin count cannot move another system’s numbers.',
  'art.measurement.sampled':
    'The equity curves are samples, not every spin. Long runs draw hundreds of thousands of results and plotting each one would be unreadable, so the engine records a bounded number of points and states when it has done so. The final point is always the true final balance rather than an interpolated one, so the end of every line is the number printed beside it.',

  'art.legitimacy.title': 'What this engine will not do',
  'art.legitimacy.summary':
    'An analysis tool that pretends to help people lose money efficiently is a worse product than no product. Three things are therefore absent by design, not by oversight.',
  'art.legitimacy.noMoney':
    'There is no currency here. No deposits, no withdrawals, no wallets, no cash-out, and nothing that can be converted into money either directly or indirectly. The balance is points that exist only in this page and are discarded when it closes.',
  'art.legitimacy.noCoercion':
    'There are no mechanics designed to make a session hard to end: no timers that expire, no streak that punishes leaving, no false scarcity, no near-miss framed as a loss the game cheated you of, and no tracking of how long or how often anyone plays. Retention is not a design goal here, because a tool that works by being difficult to stop using is not an analysis tool.',
  'art.legitimacy.noPrediction':
    'There is no number to bet on next. The wheel is a physical random process and no method overcomes it; anything that claimed otherwise would be selling something. What this engine offers is the arithmetic and the ability to run it, which is the part that is actually useful.',

  // ---- Shared -------------------------------------------------------------
  'ad.label': 'Advertisement',
  'common.loading': 'Loading…',
  'common.number': 'Number',
  'common.percent': 'Percent',
} as const

export type TranslationKey = keyof typeof en