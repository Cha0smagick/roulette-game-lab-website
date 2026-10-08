import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { en } from '../src/i18n/locales/en.js'
import { es } from '../src/i18n/locales/es.js'

const SRC = join(process.cwd(), 'src')
const LOCALES = join(SRC, 'i18n', 'locales')

/**
 * A literal string is exempt from the copy rule only when the line carries this
 * marker followed by a justification. Brand names and technical identifiers are
 * the legitimate cases; anything else is a translation that was skipped.
 *
 * The marker must appear on the SAME line as the literal — the guard scans line
 * by line and cannot see a comment placed on the line above.
 */
const EXEMPT_MARKER = 'i18n-exempt'

/** Every `.ts` file under src/, excluding the locale dictionaries themselves. */
function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full))
    } else if (entry.endsWith('.ts') && !full.startsWith(LOCALES)) {
      found.push(full)
    }
  }
  return found
}

describe('locale dictionaries', () => {
  it('ships the same keys in every locale', () => {
    // The Record<TranslationKey, string> type enforces this at compile time;
    // the runtime check guards against someone widening the type later.
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no empty or whitespace-only translations', () => {
    for (const [key, value] of Object.entries({ ...en, ...es })) {
      expect(value.trim(), `empty translation: ${key}`).not.toBe('')
    }
  })

  it('keeps the same placeholders in every locale', () => {
    // A dropped {amount} renders as literal braces in the UI. This catches it
    // in the test suite instead of on a player's screen.
    const placeholders = (value: string): string[] =>
      (value.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), `placeholder mismatch: ${key}`).toEqual(
        placeholders(en[key]),
      )
    }
  })

  it('actually translates rather than copying English', () => {
    const untranslated = (Object.keys(en) as (keyof typeof en)[]).filter(
      (key) => es[key] === en[key],
    )
    // A handful of intentionally identical values (brand name, numeric chips)
    // are legitimate; a wholesale match is not.
    expect(untranslated.length).toBeLessThan(Object.keys(en).length / 4)
  })
})

describe('no hardcoded user-facing copy', () => {
  // A string assigned to a text-bearing DOM property is copy the translator
  // cannot reach. These are the exact shapes the rule targets.
  const copyPatterns: { name: string; re: RegExp }[] = [
    { name: 'textContent', re: /\.textContent\s*=\s*(['"`])/ },
    { name: 'innerHTML', re: /\.innerHTML\s*=\s*(['"`])/ },
    { name: 'placeholder', re: /\.placeholder\s*=\s*(['"`])/ },
    { name: 'title', re: /\.title\s*=\s*(['"`])/ },
    { name: 'aria-label', re: /setAttribute\(\s*['"]aria-label['"]\s*,\s*(['"`])/ },
    { name: 'alt', re: /\.alt\s*=\s*(['"`])/ },
  ]

  it('finds no user-facing string literals outside the locale files', () => {
    const violations: string[] = []
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      text.split('\n').forEach((line, index) => {
        if (line.includes(EXEMPT_MARKER)) return
        for (const { name, re } of copyPatterns) {
          if (re.test(line)) {
            violations.push(`${file.slice(process.cwd().length + 1)}:${index + 1} ${name}`)
          }
        }
      })
    }
    expect(
      violations,
      `hardcoded copy found — route it through t():\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('requires a justification for every exemption', () => {
    // An exemption nobody justifies becomes a hole in the guard. Every one of
    // them has to say what the string is and why it is not translatable.
    const unjustified: string[] = []
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      text.split('\n').forEach((line, index) => {
        const at = line.indexOf(EXEMPT_MARKER)
        if (at < 0) return
        const reason = line.slice(at + EXEMPT_MARKER.length).replace(':', '').trim()
        if (reason.length < 10) {
          unjustified.push(
            `${file.slice(process.cwd().length + 1)}:${index + 1} — "${reason}"`,
          )
        }
      })
    }
    expect(unjustified, `exemptions need a reason:\n${unjustified.join('\n')}`).toEqual([])
  })
})