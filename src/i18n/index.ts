import { en } from './locales/en.js'
import type { TranslationKey } from './locales/en.js'
import { es } from './locales/es.js'

export type { TranslationKey }

/**
 * The locale registry. Adding a language means adding one entry here and one
 * file under `./locales/` — nothing else in the codebase changes.
 */
export const LOCALES = {
  en: { label: 'English', dictionary: en },
  es: { label: 'Español', dictionary: es },
} as const

export type LocaleCode = keyof typeof LOCALES

const STORAGE_KEY = 'reelazo.locale'
const DEFAULT_LOCALE: LocaleCode = 'en'

function isLocaleCode(value: string): value is LocaleCode {
  return Object.prototype.hasOwnProperty.call(LOCALES, value)
}

function readStored(): LocaleCode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== null && isLocaleCode(stored) ? stored : null
  } catch {
    // Private browsing or a blocked storage partition. A missing preference is
    // not an error; the default locale is a valid answer.
    return null
  }
}

/**
 * Pick the best locale for this device: an explicit stored choice wins, then a
 * match against the browser's languages, then the default.
 */
function detectLocale(): LocaleCode {
  const stored = readStored()
  if (stored !== null) return stored

  const preferred = window.navigator.languages ?? [window.navigator.language]
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (base !== undefined && isLocaleCode(base)) return base
  }
  return DEFAULT_LOCALE
}

let current: LocaleCode = DEFAULT_LOCALE
const listeners = new Set<(locale: LocaleCode) => void>()

/** Placeholder values may be numbers, so `sim.ev` can format as currency. */
export type Vars = Record<string, string | number>

function interpolate(template: string, vars: Vars | undefined): string {
  if (vars === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

/**
 * Translate a key. Unknown keys return the key itself rather than an empty
 * string, so a missing translation is visible in the UI instead of silent.
 */
export function t(key: TranslationKey, vars?: Vars): string {
  const dictionary = LOCALES[current].dictionary as Record<string, string>
  const template = dictionary[key]
  return interpolate(template ?? key, vars)
}

export function getLocale(): LocaleCode {
  return current
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(current).format(value)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(current, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Format an edge or probability. Edges below 0.01% are real and meaningful for
 * the no-zero wheel, so they are printed rather than rounded to zero.
 */
export function formatPercent(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

/** Subscribe to locale changes; returns an unsubscribe function. */
export function onLocaleChange(listener: (locale: LocaleCode) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Switch locale, persist the choice, reflect it on `<html lang>` so screen
 * readers and `:lang()` CSS rules follow, and notify subscribers.
 */
export function setLocale(locale: LocaleCode): void {
  if (!isLocaleCode(locale)) return
  current = locale
  document.documentElement.lang = locale
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Persisting the preference is best-effort; the session still switches.
  }
  for (const listener of listeners) listener(locale)
}

/** Initialise from the detected locale. Call once, before the first render. */
export function initI18n(): void {
  const locale = detectLocale()
  current = locale
  document.documentElement.lang = locale
}

/**
 * Re-render every element carrying a `data-i18n` attribute. Components emit
 * their own static structure and let this fill the text, which keeps copy out
 * of the components entirely.
 */
export function applyTranslations(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset['i18n']
    if (key !== undefined && key in LOCALES[current].dictionary) {
      node.textContent = t(key as TranslationKey)
    }
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    // Format: "aria-label:key" or "title:key"
    const spec = node.dataset['i18nAttr']
    if (spec === undefined) continue
    const separator = spec.indexOf(':')
    if (separator < 0) continue
    const attribute = spec.slice(0, separator)
    const key = spec.slice(separator + 1)
    if (key in LOCALES[current].dictionary) {
      node.setAttribute(attribute, t(key as TranslationKey))
    }
  }
}

/** Build a `<select>` that switches locale and re-renders the page. */
export function createLocalePicker(): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'locale-picker'
  select.setAttribute('data-i18n-attr', `aria-label:${'nav.language' satisfies TranslationKey}`)
  for (const code of Object.keys(LOCALES) as LocaleCode[]) {
    const option = document.createElement('option')
    option.value = code
    option.textContent = LOCALES[code].label
    if (code === current) option.selected = true
    select.append(option)
  }
  select.addEventListener('change', () => {
    const next = select.value
    if (isLocaleCode(next)) {
      setLocale(next)
      // A full re-render is the honest way to guarantee no stale copy survives
      // in a component that built its text outside applyTranslations.
      window.location.reload()
    }
  })
  return select
}