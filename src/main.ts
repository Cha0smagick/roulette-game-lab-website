import './styles/base.css'
import {
  applyTranslations,
  createLocalePicker,
  initI18n,
  t,
} from './i18n/index.js'
import type { TranslationKey } from './i18n/index.js'

/** The three pages this site ships. Rendered into the shared header. */
const PAGES = [
  { href: './', key: 'nav.table' },
  { href: './simulator.html', key: 'nav.simulator' },
  { href: './encyclopedia.html', key: 'nav.encyclopedia' },
] as const satisfies readonly { href: string; key: TranslationKey }[]

function buildHeader(): HTMLElement {
  const header = document.createElement('header')
  header.className = 'shell__header'

  const brand = document.createElement('a')
  brand.className = 'shell__brand'
  brand.href = './'
  // The exemption marker must sit on the same line as the literal; the copy
  // guard is a line scanner and cannot see a comment on the line above.
  brand.textContent = 'REELAZO' // i18n-exempt: proper noun, same in every language
  header.append(brand)

  const tagline = document.createElement('p')
  tagline.className = 'shell__tagline'
  tagline.setAttribute('data-i18n', 'tagline')
  header.append(tagline)

  const nav = document.createElement('nav')
  nav.className = 'shell__nav'
  nav.setAttribute('aria-label', t('nav.primary'))
  for (const page of PAGES) {
    const link = document.createElement('a')
    link.className = 'shell__link'
    link.href = page.href
    link.setAttribute('data-i18n', page.key)
    nav.append(link)
  }
  header.append(nav)

  header.append(createLocalePicker())
  return header
}

/**
 * The advertisement slot. Reserved space, filled in F9 once the ad unit is
 * mounted. Reserving the height up front stops the layout from shifting under
 * a player who is mid-bet, which is both a jank source and a misclick source.
 */
function buildAdSlot(): HTMLElement {
  const slot = document.createElement('aside')
  slot.className = 'adslot'
  slot.setAttribute('aria-label', t('ad.label'))
  slot.dataset['adslot'] = 'pending'
  return slot
}

function buildFooter(): HTMLElement {
  const footer = document.createElement('footer')
  footer.className = 'shell__footer'
  const note = document.createElement('p')
  // This sentence is the product's thesis and it is deliberately explicit:
  // no real money, no deposits, and the published odds are the real ones.
  note.className = 'shell__disclaimer'
  note.setAttribute('data-i18n', 'ency.intro')
  footer.append(note)
  return footer
}

function mount(root: HTMLElement): void {
  root.className = 'shell'
  root.replaceChildren(
    buildHeader(),
    document.createElement('main'),
    buildAdSlot(),
    buildFooter(),
  )
}

function boot(): void {
  initI18n()
  const root = document.getElementById('app')
  if (root === null) {
    // A blank page is the worst possible failure mode, so this is loud rather
    // than silent: the boot markup in index.html would still be visible.
    throw new Error('reelazo: #app is missing from the document')
  }
  mount(root)
  applyTranslations(root)
}

boot()