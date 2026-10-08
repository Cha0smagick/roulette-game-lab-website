import { createLocalePicker, formatNumber, t } from '../i18n/index.js'
import type { TranslationKey } from '../i18n/index.js'
import { recordVisit } from '../visits/counter.js'

/**
 * The chrome every page shares.
 *
 * One implementation rather than one per page, because a nav that disagrees
 * with itself across pages is a bug report nobody can reproduce. Marking the
 * current page also gives a screen reader the same "you are here" signal the
 * visual highlight gives everyone else.
 */

/** The pages this site ships. */
export const PAGES = [
  { href: './', key: 'nav.table' },
  { href: './simulator.html', key: 'nav.simulator' },
  { href: './analysis.html', key: 'nav.analysis' },
  { href: './encyclopedia.html', key: 'nav.encyclopedia' },
] as const satisfies readonly { href: string; key: TranslationKey }[]

export function buildHeader(currentHref: string): HTMLElement {
  const header = document.createElement('header')
  header.className = 'shell__header'

  const brand = document.createElement('a')
  brand.className = 'shell__brand'
  brand.href = './'
  // The exemption marker must sit on the same line as the literal; the copy
  // guard is a line scanner and cannot see a comment on the line above.
  brand.textContent = 'Roulette Lab' // i18n-exempt: proper noun, same in every language
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
    if (page.href === currentHref) {
      link.classList.add('shell__link--current')
      link.setAttribute('aria-current', 'page')
    }
    nav.append(link)
  }
  header.append(nav)

  header.append(createLocalePicker())
  return header
}

/** The footer, identical on every page: disclaimer, credit and visit counter. */
export function buildFooter(): HTMLElement {
  const footer = document.createElement('footer')
  footer.className = 'shell__footer'
  const note = document.createElement('p')
  // This sentence is the product's thesis and it is deliberately explicit:
  // no real money, no deposits, and the published odds are the real ones.
  note.className = 'shell__disclaimer'
  note.setAttribute('data-i18n', 'ency.intro')
  footer.append(note)

  const credit = document.createElement('p')
  credit.className = 'shell__credit'
  const label = document.createElement('span')
  // The applier replaces a [data-i18n] element's textContent, so the link must
  // be a sibling of the label rather than its child, or the language switch
  // would erase it.
  label.setAttribute('data-i18n', 'footer.credit')
  credit.append(label)
  const link = document.createElement('a')
  link.className = 'shell__credit-link'
  link.href = 'https://cha0smagicklabs.com'
  link.target = '_blank'
  link.rel = 'noopener'
  link.textContent = 'cha0smagicklabs.com' // i18n-exempt: URL/domain, same in every language
  credit.append(link)
  footer.append(credit)

  const visits = document.createElement('p')
  visits.className = 'shell__visits'
  const visitsLabel = document.createElement('span')
  visitsLabel.setAttribute('data-i18n', 'footer.visits')
  const visitsValue = document.createElement('span')
  visitsValue.className = 'shell__visits-value'
  visits.append(visitsLabel, visitsValue)
  // The counter is the only network call the footer makes, and it degrades to
  // nothing: a dead service hides the figure instead of printing a lie.
  void recordVisit().then((count) => {
    if (count === null) {
      visits.hidden = true
      return
    }
    visitsValue.textContent = formatNumber(count)
  })
  footer.append(visits)
  return footer
}