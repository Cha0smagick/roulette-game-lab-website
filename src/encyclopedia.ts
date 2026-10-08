import './styles/base.css'
import './styles/ency.css'

import { applyTranslations, formatNumber, formatPercent, initI18n, t } from './i18n/index.js'
import type { TranslationKey } from './i18n/index.js'
import { ARTICLES } from './content/index.js'
import type { EncyclopediaArticle, EncyclopediaTableId } from './content/index.js'
import { VARIANT_IDS, WHEELS } from './roulette/wheels.js'
import type { VariantId } from './roulette/wheels.js'
import { publishedTable, returnToPlayer, wheelHouseEdge } from './roulette/edge.js'
import type { BetKind } from './roulette/bets.js'
import { buildFooter, buildHeader } from './ui/shell.js'
import { createAdSlot } from './ui/adslot.js'

/**
 * The encyclopedia.
 *
 * Every number rendered here is read out of the engine at render time. Nothing
 * is typed in by hand, because a hand-typed figure in prose is a figure that
 * silently goes stale the moment the maths changes, and nobody notices until a
 * player catches it. The registry supplies the copy; the modules supply the
 * arithmetic.
 */

/** Column heading keys, declared as a tuple so a missing heading is a type error. */
const VARIANT_HEADINGS: readonly TranslationKey[] = [
  'ency.col.variant',
  'wheel.pockets',
  'ency.col.edge',
  'ency.col.rtp',
]

const BET_HEADINGS: readonly TranslationKey[] = ['ency.col.bet', 'ency.col.payout', 'ency.col.covers']

/** The wheel name is copy, and copy lives in the dictionary, not in this file. */
const VARIANT_NAME: Record<VariantId, TranslationKey> = {
  noZero: 'wheel.noZero',
  european: 'wheel.european',
  american: 'wheel.american',
}

/** The bet label lives in the dictionary already, so the table needs no copy of its own. */
function betLabel(kind: BetKind): TranslationKey {
  return `bet.${kind}`
}

function cell(value: string, className: string): HTMLTableCellElement {
  const td = document.createElement('td')
  td.className = className
  td.textContent = value
  return td
}

function headRow(headings: readonly TranslationKey[]): HTMLTableRowElement {
  const tr = document.createElement('tr')
  for (const heading of headings) {
    const th = document.createElement('th')
    th.scope = 'col'
    th.setAttribute('data-i18n', heading)
    tr.append(th)
  }
  return tr
}

/**
 * The three wheels side by side. The pocket counts come from the wheel
 * definitions, so a wheel that gained or lost a pocket would change this table
 * without anyone editing it.
 */
function wheelComparisonTable(): HTMLTableElement {
  const table = document.createElement('table')
  table.className = 'ency__table'
  table.append(headRow(VARIANT_HEADINGS))

  const body = document.createElement('tbody')
  for (const id of VARIANT_IDS) {
    const variant: VariantId = id
    const wheel = WHEELS[variant]
    const tr = document.createElement('tr')
    tr.append(cell(t(VARIANT_NAME[variant]), 'ency__cell'))
    tr.append(cell(String(wheel.pockets.length), 'ency__number'))
    tr.append(cell(formatPercent(wheelHouseEdge(variant)), 'ency__number'))
    tr.append(cell(formatPercent(returnToPlayer(variant)), 'ency__number'))
    body.append(tr)
  }
  table.append(body)

  const caption = document.createElement('caption')
  caption.setAttribute('data-i18n', 'art.wheels.summary')
  table.prepend(caption)
  return table
}

/**
 * The published payout table, read straight from the engine. `payout` is profit
 * per unit staked, which is the single most misread number in roulette: a
 * straight-up paying 35:1 returns 36 for a stake of 1, not 35.
 */
function betTable(): HTMLTableElement {
  const rows = publishedTable('european')
  const table = document.createElement('table')
  table.className = 'ency__table'
  table.append(headRow(BET_HEADINGS))

  const body = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    tr.append(cell(t(betLabel(row.kind)), 'ency__cell'))
    tr.append(cell(`${formatNumber(row.payout)}:1`, 'ency__number'))
    tr.append(cell(String(row.covers), 'ency__number'))
    body.append(tr)
  }
  table.append(body)

  const caption = document.createElement('caption')
  caption.setAttribute('data-i18n', 'art.bets.summary')
  table.prepend(caption)
  return table
}

function renderTable(id: EncyclopediaTableId): HTMLElement {
  return id === 'wheelComparison' ? wheelComparisonTable() : betTable()
}

function article(articleData: EncyclopediaArticle): HTMLElement {
  const section = document.createElement('section')
  section.className = 'ency__article'
  section.id = `art-${articleData.id}`

  const heading = document.createElement('h2')
  heading.className = 'ency__title'
  heading.setAttribute('data-i18n', articleData.title)
  section.append(heading)

  const summary = document.createElement('p')
  summary.className = 'ency__summary'
  summary.setAttribute('data-i18n', articleData.summary)
  section.append(summary)

  if (articleData.table !== null) section.append(renderTable(articleData.table))

  for (const paragraphKey of articleData.paragraphs) {
    const paragraph = document.createElement('p')
    paragraph.setAttribute('data-i18n', paragraphKey)
    section.append(paragraph)
  }

  return section
}

function contents(): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'ency__contents'
  nav.setAttribute('data-i18n-attr', 'aria-label:ency.contents')

  const list = document.createElement('ol')
  for (const entry of ARTICLES) {
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.href = `#art-${entry.id}`
    link.setAttribute('data-i18n', entry.title)
    li.append(link)
    list.append(li)
  }
  nav.append(list)
  return nav
}

function page(): HTMLElement {
  const main = document.createElement('main')
  main.className = 'ency'

  const heading = document.createElement('h1')
  heading.className = 'ency__heading'
  heading.setAttribute('data-i18n', 'h1.encyclopedia')
  main.append(heading)

  const intro = document.createElement('p')
  intro.className = 'ency__intro'
  intro.setAttribute('data-i18n', 'ency.intro')
  main.append(intro)

  main.append(contents())

  for (const entry of ARTICLES) main.append(article(entry))

  return main
}

function mount(root: HTMLElement): void {
  const slot = createAdSlot()
  root.className = 'shell shell--page'
  root.replaceChildren(buildHeader('./encyclopedia.html'), page(), slot.element, buildFooter())

  // Last, exactly as on the other two pages: the table of contents above must be
  // interactive before anything third-party is allowed on the page.
  slot.mount()
}

function boot(): void {
  initI18n()
  const root = document.getElementById('app')
  if (root === null) throw new Error('Missing #app root element')
  mount(root)
  applyTranslations(root)
}

boot()