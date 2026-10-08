import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordVisit } from '../src/visits/counter.js'

function locale(name: string): string {
  return readFileSync(new URL(`../src/i18n/locales/${name}.ts`, import.meta.url), 'utf8')
}

describe('the visit counter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the total the service reports', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ value: 42 }), { status: 200 })),
    )
    await expect(recordVisit()).resolves.toBe(42)
  })

  it('degrades to nothing when the service answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 500 })),
    )
    await expect(recordVisit()).resolves.toBeNull()
  })

  it('degrades to nothing when the network itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      }),
    )
    await expect(recordVisit()).resolves.toBeNull()
  })

  it('is named in both locales', () => {
    for (const name of ['en', 'es']) {
      expect(locale(name)).toContain("'footer.visits'")
    }
  })

  it('is wired into the shared footer', () => {
    const source = readFileSync(new URL('../src/ui/shell.ts', import.meta.url), 'utf8')
    expect(source).toContain("'footer.visits'")
    expect(source).toContain('recordVisit()')
  })
})
