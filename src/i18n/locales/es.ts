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
  'nav.analysis': 'Análisis',
  'nav.language': 'Idioma',
  'nav.primary': 'Principal',
  'tagline': 'Mide la rueda, no la adivines.',

  'h1.table': 'Mesa de ruleta',
  'h1.simulator': 'Simulador de estrategias',
  'h1.encyclopedia': 'Enciclopedia de ruleta',
  'h1.analysis': 'Análisis en vivo',

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
  'board.layer.numbers': 'Números',
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
  'ency.col.variant': 'Variante',
  'ency.col.edge': 'Ventaja de la casa',
  'ency.col.rtp': 'Retorno al jugador',
  'ency.col.bet': 'Apuesta',
  'ency.col.payout': 'Pago',
  'ency.col.covers': 'Números cubiertos',

  // ---- Artículos de la enciclopedia ----
  // Claves con el formato art.<id>.<parte>. src/content/index.ts extrae de este
  // diccionario la unión de esas claves, así que una entrada del registro que
  // apunte a una clave inexistente rompe la compilación en vez de mostrar un
  // encabezado vacío en producción.
  'art.wheels.title': 'Las tres ruedas',
  'art.wheels.summary':
    'Una rueda de ruleta es una bolsa de resultados con una distribución concreta, y las tres variantes solo se diferencian en qué más hay en la bolsa. Todo lo demás de esta página se deduce de ese único hecho.',
  'art.wheels.layout':
    'Los números del 1 al 36 aparecen una sola vez en cada rueda. Lo que cambia es el cero. La rueda sin cero no tiene ninguno y paga 1 a 1 en todas las apuestas, de modo que es un juego justo: el retorno esperado de cualquier apuesta es exactamente lo apostado. La rueda europea añade un cero, y la americana añade un segundo cero impreso como 00. Esos ceros son toda la diferencia entre una rueda que no le cuesta nada al jugador y una que se queda con un pequeño porcentaje de cada apuesta.',
  'art.wheels.green':
    'El cero y, en la rueda americana, el 00 son de color verde en lugar de rojo o negro. No es decoración. Rojo y negro son apuestas 1 a 1, y un bolsillo verde no gana ninguna de las dos, que es exactamente el mecanismo por el que el cero extrae el margen de la casa en apuestas que parecen simétricas. En la rueda americana los dos bolsillos cero pierden las mismas apuestas, y por eso su margen es mayor que el de la europea.',
  'art.wheels.ordering':
    'El orden de los números alrededor de una rueda real es deliberadamente irregular, de modo que ninguna secuencia de vecinos contiene información. Este motor guarda el orden horario real de cada rueda en lugar de ordenar del 1 al 36, porque una disposición ordenada haría que los números vecinos parecieran significativos cuando no lo son.',

  'art.bets.title': 'Las catorce apuestas',
  'art.bets.summary':
    'Una apuesta es una afirmación sobre qué bolsillos ganarían. La ruleta tiene catorce formas estándar de esa afirmación, y se diferencian mucho en su probabilidad y en cuánto pagan cuando ganan. La tabla de abajo se genera a partir de las mismas constantes con las que juega el motor, así que no puede quedar desactualizada.',
  'art.bets.payout':
    'El pago indicado para cada apuesta es la ganancia por unidad apostada, no el total devuelto. Una apuesta a número pleno paga 35 a 1, así que una apuesta de 1 devuelve 36 cuando gana: los 35 de ganancia más el 1 apostado. Leer esa cifra como 35 devueltos en lugar de 35 ganados es el malentendido más común en cualquier tabla de pagos de ruleta, y hace que la apuesta parezca mucho peor de lo que es.',
  'art.bets.coverage':
    'La columna de cobertura es el número de bolsillos que hacen ganar la apuesta, y es el denominador de la probabilidad. Un número pleno cubre 1 bolsillo de 37 en una rueda de un cero, por eso paga tanto. El rojo cubre 18. Las apuestas 1 a 1 y las docenas y columnas cubren 12 o 18, y por eso pagan 1 a 1 y 2 a 1 respectivamente.',
  'art.bets.stake':
    'Las apuestas se acumulan. Colocar una segunda ficha sobre una apuesta que ya tienes cubierta la suma en vez de sustituirla, y la apuesta combinada se liquida como una sola apuesta al mismo tipo de pago. No hay ventaja en repartir el mismo dinero entre varias apuestas: el retorno esperado por unidad apostada es idéntico en ambos casos, así que dividir solo hace el resultado más ruidoso.',

  'art.edge.title': 'De dónde sale el margen de la casa',
  'art.edge.summary':
    'El margen de la casa no es un ajuste oculto que se aplique a tus ganancias. Es la consecuencia aritmética de los ceros, y es el mismo en todas las apuestas y en todas las ruedas.',
  'art.edge.zero':
    'Una apuesta 1 a 1 gana en 18 bolsillos, pierde en 18, y empata o pierde en el cero. En una rueda de un cero eso son 18 ganancias contra 19 pérdidas. Como cada ganancia devuelve una unidad de beneficio y cada pérdida cuesta una unidad, el resultado esperado por tirada es 18/37 de unidad ganada contra 19/37 perdida, lo que equivale a perder una unidad cada 37: el 2,70 % de margen de la rueda europea. En la rueda americana el mismo cálculo da 18 contra 20, es decir una unidad cada 38, el 5,26 %. En una rueda sin cero da 18 contra 18, y el margen es exactamente cero.',
  'art.edge.uniformity':
    'Una apuesta a docena o columna cubre 12 bolsillos y paga 2 a 1, así que gana 12 veces y pierde 24 en una rueda de un cero. Doce ganancias de dos unidades contra 24 pérdidas de una unidad son exactamente 24 unidades en cada dirección, y lo que desequilibra los dos lados no es la cobertura sino el cero. Por eso el margen no varía entre apuestas internas y externas.',
  'art.edge.same':
    'Toda apuesta en una rueda dada tiene la misma pérdida esperada por unidad apostada, ya sea un número pleno que paga 35 a 1 o un rojo que paga 1 a 1. En este proyecto hay una prueba que lo comprueba con diez decimales en las catorce apuestas. Ninguna combinación de apuestas puede superar el margen, porque cada una lo arrastra por separado y sumarlas suma los márgenes en lugar de cancelarlos.',

  'art.systems.title': 'Sistemas de progresión y qué hacen',
  'art.systems.summary':
    'Un sistema de progresión cambia cuánto apuestas tras cada resultado. No puede cambiar lo que hace la rueda. Aquí tienes ocho de los más conocidos, qué hace cada uno realmente y por qué los ocho pierden.',
  'art.systems.advance':
    'Una progresión decide la apuesta de la tirada n a partir de los resultados anteriores. Esa es una regla sobre tu propio capital, y la rueda no tiene acceso a ella. El resultado es que la secuencia de tiradas a la que el sistema reacciona es la misma que vería un jugador que no reacciona; lo único que ha cambiado son las fichas asignadas a cada una. Como el margen se aplica por unidad apostada, cambiar las fichas cambia la velocidad a la que se paga, no si se paga.',
  'art.systems.bankroll':
    'Lo que una progresión sí cambia es la distribución de resultados. La martingala y sus parientes apostan una cantidad que crece con la racha de pérdidas, así que el resultado habitual es una ganancia pequeña y el resultado raro es la pérdida total del capital. El valor esperado de la secuencia no cambia y sigue siendo negativo. Lo que sí cambia es la forma del riesgo: la sesión media termina en ganancia, y una minoría termina sin nada, un patrón más difícil de notar desde dentro que un descenso constante.',
  'art.systems.verdict':
    'Un límite de mesa acota la apuesta, y toda progresión salvo la apuesta plana lo acaba tocando. Una progresión que no puede crecer ha dejado de ser una progresión: es una apuesta plana con pasos de más. Esa convención no la inventó ningún casino para frenar a los jugadores. Cualquier capital finito se encuentra antes o después con un límite finito, y el límite solo decide cuándo termina la aritmética.',

  'art.fallacy.title': 'Independencia, rachas y justicia',
  'art.fallacy.summary':
    'La manera más común de perder dinero en la ruleta no es un mal sistema. Es un modelo equivocado de lo que la rueda está haciendo.',
  'art.fallacy.independence':
    'Cada tirada es independiente de las anteriores. La rueda no recuerda que saliera rojo nueve veces, ni tiene obligación de que salga más negro por eso. En cada tirada todos los números de la rueda son igual de probables independientemente de lo anterior, y esa es la única razón por la que el margen de la casa es constante y la única razón por la que ningún patrón es explotable.',
  'art.fallacy.streaks':
    'Las rachas existen porque tienen que existir. Las longitudes de racha son geométricas: en una moneda justa, la probabilidad de que salga tres veces la misma cara es uno entre cuatro, y la probabilidad de que aparezca alguna racha de cinco o más a lo largo de unos cientos de tiradas es casi segura. Una racha es evidencia de que la rueda es aleatoria, no evidencia de que haya terminado y de que la siguiente tirada deba compensar.',
  'art.fallacy.fairness':
    'Una rueda no se pone «al día». Tras diez rojos, la undécima tirada sigue siendo 18/37 rojo en una rueda de un cero. La esperanza describe una secuencia larga de tiradas, no la siguiente, y cualquier estrategia que trate la secuencia corta como si tuviera que parecerse a la larga está describiendo otro juego distinto del que se está jugando.',

  'art.measurement.title': 'Cómo mide este motor',
  'art.measurement.summary':
    'En este sitio nada se afirma sin calcularse. Las tablas, los márgenes y los resultados de la simulación los produce el mismo código que juega la partida.',
  'art.measurement.derived':
    'El margen de la casa de la tabla anterior se obtiene enumerando cada bolsillo de la rueda en cada apuesta y promediando el resultado, en lugar de leerlo de una constante. El número impreso es el número que produjo el código. Esto importa porque un margen declarado solo es tan fiable como quien lo declaró, y uno derivado no puede discrepar de las apuestas que describe.',
  'art.measurement.seeded':
    'El generador aleatorio tiene semilla, y la semilla se muestra. Una sesión puede por tanto reproducirse exactamente: la misma semilla y el mismo número de tiradas producen los mismos números, así que cualquier resultado de este sitio puede comprobarse en lugar de aceptarse por confianza. En el simulador cada sistema recibe su propio flujo derivado de la semilla, así que cambiar el número de tiradas de un sistema no mueve los números de otro.',
  'art.measurement.sampled':
    'Las curvas de capital son muestras, no todas las tiradas. Las ejecuciones largas generan cientos de miles de resultados y dibujar cada uno sería ilegible, así que el motor registra un número acotado de puntos y avisa cuando lo ha hecho. El punto final es siempre el saldo final real y no uno interpolado, de modo que el extremo de cada línea es el número impreso junto a ella.',

  'art.legitimacy.title': 'Lo que este motor no hará',
  'art.legitimacy.summary':
    'Una herramienta de análisis que finge ayudar a la gente a perder dinero de forma eficiente es peor producto que no tener producto. Por eso faltan tres cosas por decisión de diseño, no por descuido.',
  'art.legitimacy.noMoney':
    'Aquí no hay moneda. No hay depósitos, ni retiradas, ni monederos, ni «cobrar», ni nada que pueda convertirse en dinero ni directa ni indirectamente. El saldo son puntos que existen únicamente en esta página y se pierden al cerrarla.',
  'art.legitimacy.noCoercion':
    'No hay mecánicas diseñadas para que una sesión cueste terminar: ni temporizadores que caducan, ni rachas que castiguen marcharse, ni escasez falsa, ni casi-ganancias presentadas como pérdidas que el juego te arrebató, ni registro de cuánto o cuántas veces juega nadie. La retención no es un objetivo de diseño aquí, porque una herramienta que funciona por ser difícil de dejar de usar no es una herramienta de análisis.',
  'art.legitimacy.noPrediction':
    'No hay un número al que apostar la próxima vez. La rueda es un proceso físico aleatorio y ningún método lo vence; cualquier cosa que afirmara lo contrario estaría vendiendo algo. Lo que ofrece este motor es la aritmética y la posibilidad de ejecutarla, que es la parte realmente útil.',

  // ---- Historial en vivo y recuentos observados (G1) ---------------------
  'analysis.intro':
    'Todo en esta página es un recuento de tiradas que ocurrieron de verdad, mostrado junto a lo que produciría una rueda justa.',
  'analysis.source':
    'Se lee solo de este navegador. Las tiradas jugadas en otro sitio no se cuentan aquí, y nada sale de tu dispositivo.',
  'hist.title': 'Historial de tiradas',
  'hist.newest': 'Lo más reciente primero',
  'hist.empty': 'Aún no hay tiradas registradas. Juega unas cuantas en la mesa.',
  'hist.cell': '{number}, {colour}',
  'common.colour.red': 'rojo',
  'common.colour.black': 'negro',
  'common.colour.green': 'verde',
  'stats.title': 'Recuentos observados',
  'stats.total': 'Tiradas registradas',
  'stats.colourRun': 'Racha de color actual',
  'stats.pocketStreak': 'Número repetido',
  'stats.hottest': 'Más frecuentes',
  'stats.coldest': 'Menos frecuentes',
  'stats.none': 'Ninguno',
  'stats.inARow': '{count} seguidas',
  'stats.caption':
    'Son observaciones, no señales. La rueda no tiene memoria, así que ninguno de estos recuentos cambia las probabilidades de la próxima tirada.',

  'ad.label': 'Publicidad',
  'common.loading': 'Cargando…',
  'common.number': 'Número',
  'common.percent': 'Porcentaje',
}