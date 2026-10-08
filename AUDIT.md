# Roulette Lab — Guía atómica de resolución de problemas

> Auditoría quirúrgica completa del casino web (2026-10-08). Cada hallazgo lleva evidencia
> (`archivo:línea`), estado y resolución. Este documento es la guía atómica: seguir el
> **orden de resolución** (§4) paso a paso, un commit por fix, `npm run verify` verde
> antes de CADA commit.

## 1. Estado general verificado

| Área | Estado | Evidencia |
|---|---|---|
| Typecheck | ✅ | `npm run typecheck` limpio |
| Tests | ✅ 324/324 | 15 archivos de test (ads, boot, content, design-system, detectors, history-ui, hypothesis-ui, i18n, mobile-shell, rng, roulette, sim, stats, table, wheel) |
| Build | ✅ 9 chunks | boot-D5gfNOLB.js 38.8 kB · index-DkUyzH1v.js (entry loader) · analysis · bets · encyclopedia · history-store · rng · simulator · worker |
| Tamaño | ✅ | boot 40.00 kB / 14.50 kB gz — total ~34 kB gz < 120 kB budget |
| Deploy | ✅ corregido | gh-pages sirve el bundle con `dataset.adslotPlacement` (camelCase) tras push `b8e1b21` — el crash de arranque (`SyntaxError: 'adslot-placement' is not a valid property name`) quedó resuelto en producción |
| Dependencias | ✅ | Zero runtime deps; devDeps: typescript, vite, vitest |

## 2. Arquitectura verificada (sin daño)

- **4 páginas** en raíz: `index.html` (Live table), `simulator.html`, `analysis.html`,
  `encyclopedia.html` — todas con elemento de arranque `#app`, `noscript`,
  `viewport-fit=cover`, `color-scheme dark`, `theme-color #0B1026`.
- **Núcleo de ruleta** (`src/roulette/`): tres variantes con orden real de números
  (Europea `0,32,15,19,4,21,…` · Americana `0,28,9,26,30,11,…`), noZero 1–36 con edge
  exactamente 0; diez tipos de apuesta; `settle.ts` puro; `edge.ts` derivado;
  house edge 2.70 % / 5.26 % / 0.00 % publicado.
- **Mesa** (`src/table/`, `src/ui/board.ts`, `src/ui/chips.ts`): saldo como único límite
  (invariante documentada en `table.ts:26` y `table.ts:164`), undo, rebet, clear,
  teclado en chips, reducer puro.
- **Renderizador** (`src/ui/wheel.ts`, `anim.ts`): canvas + animación + guard de giro.
- **i18n** (`src/i18n/`): en/es tipado, `<html lang>`, persistencia, copy guard
  (escáner de literales visibles fuera de los ficheros de locale).
- **Anuncios** (`src/ads/`): aads.com + 3 colocaciones + 8 slots, montaje diferido
  (chunk `boot-*.js`), sin imports desde `src/game|src/roulette`.
- **Análisis** (`src/stats/`): detectores (`repeat, alternating, colourRun,
  hotContinuation, coldContinuation, recentWindow`) + chi-cuadrado + desviación por
  número; cada `expected` derivado del volante, nunca tecleado.
- **Simulador** (`simulator.html` + worker): 300 000 giros, EV, varianza, drawdown.
- **Enciclopedia**: aritmética, no folclore.

## 3. Hallazgos de la auditoría

### H1 — Branding cha0smagicklabs.com AUSENTE  ⛔ (prioridad del usuario)
- **Evidencia:** ningún crédito ni hipervínculo a cha0smagicklabs.com en `src/**`.
  `buildFooter()` (`src/ui/shell.ts:59-69`) solo pinta el disclaimer
  (`className 'shell__disclaimer'`, `note.setAttribute('data-i18n', 'ency.intro')`).
  El footer es compartido por las 4 páginas (`main.ts:250`, `simulator.ts:241`,
  `analysis.ts:87`, `encyclopedia.ts:205`).
- **Resolución:** clave `footer.credit` en `en.ts`/`es.ts` + línea de crédito en
  `buildFooter()` con `<a href="https://cha0smagicklabs.com" target="_blank"
  rel="noopener">cha0smagicklabs.com</a>` + clase CSS `.shell__credit` + test
  design-system.

### H2 — `markov.ts` código muerto (completa G3, PLAN §9.4)  ⚠️
- **Evidencia:** módulo completo (`classifyByColour:57`, `classifyByParity:67`,
  `stateProbabilities:121`, `transitionMatrix:139`) importado SOLO por
  `test/detectors.test.ts` — cero importers en `src` → tree-shaken del bundle.
- **Resolución:** cablear la matriz de transición observada en el panel de hipótesis
  (página de análisis) + claves i18n + test.

### H3 — Autoplay ausente  ⚠️
- **Evidencia:** cero hits de autoplay en `src/**`. Es la característica
  característica de los casinos online.
- **Resolución:** toggle en `main.ts` reutilizando `spin()` (repite la apuesta actual
  hasta parar o quedarse sin saldo) + claves i18n + test.

### H4 — Acción `reset` muerta en la UI  ℹ️ (menor)
- **Evidencia:** `TableAction` incluye `{type:'reset'}` y el reducer la procesa
  (`{...INITIAL_TABLE, chip: state.chip}`), pero `main.ts` solo construye los botones
  spin/clear/undo/rebet/newSeed (líneas 134-165) — ningún botón de reset. El saldo NO
  se persiste (recargar ya resetea), así que el reload es el reset natural.
- **Resolución:** cablear un botón reset (usa la acción existente) + clave i18n + test.

### H5 — No son GAPS (verificado)
- **Límites de mesa:** el saldo es TODO el límite — invariante documentada
  (`table.ts:26`, `table.ts:164`); un límite separado sería redundante.
- **Sonidos:** no estaban planificados (candidato a fase futura).
- **Visual QA real:** gap honesto del README (publicado, nunca abierto en navegador
  real) — pendiente externo.
- **Aprobación del ad unit:** dependencia externa (ingresos en cero hasta aprobar).

## 4. ORDEN DE RESOLUCIÓN (guía atómica)

1. **[hecho]** Escribir esta guía (`AUDIT.md`).
2. **Branding (H1):** `footer.credit` en `src/i18n/locales/en.ts` + `es.ts` →
   crédito + hipervínculo en `buildFooter()` (`src/ui/shell.ts`) → `.shell__credit`
   en `src/styles/` → test design-system → `npm run verify` → **commit**.
3. **Markov (H2):** cablear `stateProbabilities`/`transitionMatrix` en el panel de
   hipótesis (`src/ui/hypothesis-panel.ts`) → claves i18n → test → `npm run verify`
   → **commit**. Completa G3.
4. **Autoplay (H3):** toggle en `main.ts` reutilizando `spin()` → claves i18n → test
   → `npm run verify` → **commit**.
5. **Reset (H4):** botón reset en `main.ts` (acción existente) → clave i18n → test
   → `npm run verify` → **commit**.
6. **Cierre:** `npm run verify` completo → `git push` (el deploy de gh-pages publica
   los fixes y el branding queda visible en la web).
7. **Diferido (externo/futuro):** sonidos, folclore en enciclopedia, visual QA en
   navegador real, aprobación del ad unit en aads.com.

## 5. Reglas de la guía

- `npm run verify` verde antes de CADA commit (typecheck + tests + build).
- Todo texto visible pasa por `t('clave')` — cero copy duro en componentes
  (el copy guard escanea `src/**` y falla el build con literales fuera de locale).
- Nombres de `dataset` SIEMPRE en camelCase (`dataset.adslotPlacement`) — el setter
  de DOMStringMap lanza SyntaxError con nombres con guion en Chrome real (jsdom no
  lo detecta).
- Cada fix es atómico: un commit, un propósito, revertible.
