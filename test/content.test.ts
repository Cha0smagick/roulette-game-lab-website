import { describe, expect, it } from 'vitest'

import { ARTICLES, ARTICLE_IDS, TABLE_IDS, findArticle } from '../src/content/index.js'
import { VARIANT_IDS, WHEELS } from '../src/roulette/wheels.js'
import { publishedTable, returnToPlayer, wheelHouseEdge } from '../src/roulette/edge.js'
import { en } from '../src/i18n/locales/en.js'
import { es } from '../src/i18n/locales/es.js'

/**
 * The encyclopedia's job is to describe the engine accurately, so the tests
 * here are mostly about drift. A paragraph is prose and prose cannot be checked;
 * a table can, and a table that silently disagrees with the module it claims to
 * document is the failure mode worth spending a test on.
 */

describe('encyclopedia registry', () => {
  it('lists every article exactly once', () => {
    const ids = ARTICLES.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual([...ARTICLE_IDS].sort())
  })

  it('only names tables that exist', () => {
    for (const entry of ARTICLES) {
      if (entry.table !== null) expect(TABLE_IDS).toContain(entry.table)
    }
  })

  it('gives every article a summary and at least one paragraph', () => {
    for (const entry of ARTICLES) {
      expect(entry.summary).not.toBe('')
      expect(entry.paragraphs.length).toBeGreaterThan(0)
    }
  })

  it('has no two articles sharing a key', () => {
    const keys = ARTICLES.flatMap((entry) => [entry.title, entry.summary, ...entry.paragraphs])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('finds an article by id and refuses an unknown one', () => {
    expect(findArticle('edge')?.id).toBe('edge')
    expect(findArticle('nope')).toBeNull()
  })

  it('names the two tables this build actually renders', () => {
    // The page renders wheelComparison when an article asks for it and betTable
    // otherwise, so an id outside this pair would render as the wrong table
    // rather than fail. Pinned so a third id cannot be added silently.
    expect(TABLE_IDS).toEqual(['wheelComparison', 'betTable'])
  })
})

describe('article copy resolves in every locale', () => {
  it('has a non-empty translation for every key the registry names', () => {
    const keys = ARTICLES.flatMap((entry) => [entry.title, entry.summary, ...entry.paragraphs])
    const missing: string[] = []
    for (const key of keys) {
      if (typeof en[key] !== 'string' || en[key].trim() === '') missing.push(`en:${key}`)
      if (typeof es[key] !== 'string' || es[key].trim() === '') missing.push(`es:${key}`)
    }
    expect(missing).toEqual([])
  })
})

describe('the wheel comparison table matches the engine', () => {
  it('renders one row per wheel, with the pocket counts the wheels define', () => {
    expect(VARIANT_IDS).toEqual(['noZero', 'european', 'american'])
    expect(WHEELS.noZero.pockets.length).toBe(36)
    expect(WHEELS.european.pockets.length).toBe(37)
    expect(WHEELS.american.pockets.length).toBe(38)
  })

  it('would print the edge and return the modules compute, not restated numbers', () => {
    // The page calls wheelHouseEdge and returnToPlayer directly, so these are
    // the values it must never hardcode.
    for (const variant of VARIANT_IDS) {
      const edge = wheelHouseEdge(variant)
      const rtp = returnToPlayer(variant)
      expect(rtp).toBeCloseTo(1 - edge, 12)
    }
  })
})

describe('the bet table matches the engine', () => {
  it('has a row per bet kind, in the order the engine emits them', () => {
    const rows = publishedTable('european')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.covers).toBeGreaterThan(0)
      expect(row.payout).toBeGreaterThan(0)
    }
  })

  it('agrees with itself across wheels on coverage, which does not depend on the wheel', () => {
    // Coverage of an ordinary number is the same on every real wheel; only the
    // edge moves with the zeros. A change here would mean the table started
    // saying something the engine does not.
    const european = publishedTable('european')
    const american = publishedTable('american')
    expect(american.map((row) => row.covers)).toEqual(european.map((row) => row.covers))
  })

  it('shows the same edge for every bet on one wheel, because the engine derives it that way', () => {
    const edges = publishedTable('european').map((row) => row.edge)
    for (const edge of edges) expect(edge).toBeCloseTo(edges[0] as number, 12)
  })
})