/**
 * Spanish locale.
 *
 * Its presence is the proof that the i18n layer actually works. A system that
 * claims to be translatable but ships one language has not been demonstrated.
 */
import type { TranslationKey } from './en.js'

export const es: Record<TranslationKey, string> = {
  'nav.table': 'Mesa',
  'nav.simulator': 'Simulador',
  'nav.encyclopedia': 'Enciclopedia',
  'nav.language': 'Idioma',
  'nav.primary': 'Principal',
  'tagline': 'La publicidad es tu combustible.',

  'h1.table': 'Mesa de ruleta',
  'h1.simulator': 'Simulador de estrategias',
  'h1.encyclopedia': 'Enciclopedia de ruleta',

  'table.spin': 'Girar',
  'table.clear': 'Limpiar apuestas',
  'table.undo': 'Deshacer',
  'table.rebet': 'Repetir',
  'table.balance': 'Saldo',
  'table.wager': 'Apuesta total',
  'table.payout': 'Pago',
  'table.net': 'Neto',
  'table.seed': 'Semilla',
  'table.seedHint': 'Cada giro es reproducible a partir de esta semilla.',
  'table.newSeed': 'Nueva semilla',
  'table.variant': 'Rueda',
  'table.history': 'Historial',
  'table.stats': 'Estadísticas',
  'table.hot': 'Calientes',
  'table.cold': 'Fríos',
  'table.streak': 'Racha',
  'table.emptyBoard': 'Elige una o más fichas y toca una zona de apuesta.',
  'table.tooPoor': 'Saldo insuficiente para esa apuesta.',
  'table.spinning': 'Girando…',
  'table.resultWin': 'Ganaste {amount}',
  'table.resultLoss': 'Sin premio',
  'table.resultPush': 'Empate',
  'table.wheel': 'Rueda de ruleta',

  'chip.select': 'Ficha',
  'chip.1': '1',
  'chip.5': '5',
  'chip.25': '25',
  'chip.100': '100',

  'wheel.noZero': 'Sin cero (36)',
  'wheel.european': 'Europea (0)',
  'wheel.american': 'Americana (0, 00)',
  'wheel.edge': 'Ventaja de la casa {value}',
  'wheel.pockets': 'Casillas',

  'bet.straight': 'Number completo',
  'bet.split': 'Caballo',
  'bet.street': 'Transversal',
  'bet.corner': 'Cuadrada',
  'bet.line': 'Seis números',
  'bet.column': 'Columna',
  'bet.dozen': 'Docena',
  'bet.red': 'Rojo',
  'bet.black': 'Negro',
  'bet.odd': 'Impar',
  'bet.even': 'Par',
  'bet.low': '1–18',
  'bet.high': '19–36',
  'bet.streetNumbers': 'Transversal {numbers}',
  'bet.cornerNumbers': 'Cuadrada {numbers}',
  'bet.lineNumbers': 'Seis números {numbers}',
  'board.layers': 'Capa de apuesta',
  'board.layer.street': 'Transversal',
  'board.layer.corner': 'Cuadrada',
  'board.layer.line': 'Seis números',

  'sim.run': 'Ejecutar simulación',
  'sim.running': 'Ejecutando…',
  'sim.strategies': 'Estrategias',
  'sim.spins': 'Giros por estrategia',
  'sim.seed': 'Semilla',
  'sim.tableLimit': 'Límite de mesa',
  'sim.bankroll': 'Capital inicial',
  'sim.results': 'Resultados',
  'sim.strategy': 'Estrategia',
  'sim.final': 'Capital final',
  'sim.ev': 'VE / giro',
  'sim.roi': 'Retorno',
  'sim.drawdown': 'Caída máxima',
  'sim.ruin': 'Probabilidad de ruina',
  'sim.survived': 'Sobrevivió',
  'sim.busted': 'Quebró',
  'sim.spinCount': 'giros',
  'sim.equity': 'Capital en el tiempo',
  'sim.verdict': 'Veredicto',
  'sim.truncated': 'Resultados truncados para mostrar. La serie completa solo está en memoria.',
  'sim.strategy.flat': 'Plana',
  'sim.strategy.flatDesc':
    'Apuesta la misma cantidad en cada giro. Ignora el resultado anterior.',
  'sim.strategy.martingale': 'Martingala',
  'sim.strategy.martingaleDesc':
    'Dobla tras cada pérdida y reinicia tras ganar. Exige capital ilimitado y una mesa sin límite.',
  'sim.strategy.reverseMartingale': 'Martingala inversa',
  'sim.strategy.reverseMartingaleDesc':
    'Dobla tras cada ganar y baja un escalón tras perder. Arriesga poco y gana rara vez.',
  'sim.strategy.labouchere': 'Labouchère',
  'sim.strategy.labouchereDesc':
    'Recorre una lista de apuestas sumando el total al perder y restándolo al ganar.',
  'sim.strategy.fibonacci': 'Fibonacci',
  'sim.strategy.fibonacciDesc':
    'Sube por la secuencia de Fibonacci al perder y baja un escalón al ganar.',
  'sim.strategy.dAlembert': "D'Alembert",
  'sim.strategy.dAlembertDesc':
    'Suma una unidad al perder y resta una al ganar. Una progresión negativa más suave.',
  'sim.strategy.oscarGrind': 'Oscar Grind',
  'sim.strategy.oscarGrindDesc':
    'Apuesta una unidad más cuando va ganando y una menos cuando va perdiendo.',
  'sim.strategy.columnProgression': 'Progresión de columna',
  'sim.strategy.columnProgressionDesc':
    'Apuesta progresiva a una columna y vuelve al inicio al ganar.',
  'sim.allStrategies': 'Seleccionar todas',
  'sim.none': 'Ninguna',
  'sim.points': 'Puntos de capital',
  'sim.failed': 'La simulación falló: {message}',
  'sim.mainThread': 'Ejecutando en el hilo principal. Una ejecución larga congelará la página.',

  'ency.intro':
    'Este motor no predice: mide. La rueda es un proceso físico aleatorio y ningún método lo vence. Lo que sigue es la aritmética, y los resultados de la simulación son esa aritmética en ejecución.',
  'ency.readMore': 'Leer',
  'ency.contents': 'Contenido',

  'ad.label': 'Publicidad',
  'common.loading': 'Cargando…',
  'common.number': 'Número',
  'common.percent': 'Porcentaje',
}