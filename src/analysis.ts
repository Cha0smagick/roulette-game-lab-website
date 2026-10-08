import './styles/base.css'
import './styles/analysis.css'
import { applyTranslations, initI18n, t } from './i18n/index.js'
import { buildFooter, buildHeader } from './ui/shell.js'
import { createAdSlot } from './ui/adslot.js'
import { createHistoryStrip } from './ui/history.js'
import { createStatsPanel } from './ui/stats.js'
import { loadHistory } from './ui/history-store.js'
import { boot } from './ui/boot.js'

/**
 * The analysis page: what the recorded spins actually look like.
 *
 * It reads the same history the table page writes, which is the only reason it
 * exists as a separate document rather than a panel on the table. A dense
 * statistical view and a playable table want opposite things from the same
 * screen -- one wants every pixel for a number, the other wants thumb-sized
 * controls -- and putting both on one page gives both of them a compromise.
 *
 * Nothing on this page is computed from a formula about what *should* happen.
 * Every figure is a count of spins that happened. The comparison against a fair
 * wheel's expectations is deliberately not here yet, and its absence is the
 * point: a raw count with an honest caption is worth more than a rate with no
 * reference beside it.
 */

function section(titleKey: Parameters<typeof t>[0], body: HTMLElement): HTMLElement {
  const wrap = document.createElement('section')
  wrap.className = 'analysis__section'
  const heading = document.createElement('h2')
  heading.className = 'analysis__subtitle'
  heading.setAttribute('data-i18n', titleKey)
  wrap.append(heading, body)
  return wrap
}

function page(): HTMLElement {
  const main = document.createElement('main')
  main.className = 'analysis'

  const title = document.createElement('h1')
  title.setAttribute('data-i18n', 'h1.analysis')

  const intro = document.createElement('p')
  intro.className = 'analysis__intro'
  intro.setAttribute('data-i18n', 'analysis.intro')

  const strip = createHistoryStrip()
  const panel = createStatsPanel()
  const source = document.createElement('p')
  source.className = 'analysis__source'
  source.setAttribute('data-i18n', 'analysis.source')

  // An in-article unit sits between the observed counts and the provenance note
  // rather than at the foot of the page. A reader who scrolls to the bottom has
  // stopped; one halfway down a page of figures is still reading.
  const inline = createAdSlot({ placement: 'inline' })
  inline.sync()

  main.append(
    title,
    intro,
    section('hist.title', strip.element),
    section('stats.title', panel.element),
    inline.element,
    source,
  )

  const history = loadHistory()
  strip.render(history)
  panel.render(history)
  return main
}

function mount(root: HTMLElement): void {
  const slot = createAdSlot({ placement: 'footer' })
  root.className = 'shell shell--page'
  root.replaceChildren(buildHeader('./analysis.html'), page(), slot.element, buildFooter())
  // Last, after the content is in the document. The unit is a passive
  // third-party iframe, so there is nothing to coordinate with it, but a slot
  // that syncs first spends the first-paint budget on an ad nobody asked for.
  slot.sync()
}

boot('app', (root) => {
  initI18n()
  mount(root)
  applyTranslations(root)
})