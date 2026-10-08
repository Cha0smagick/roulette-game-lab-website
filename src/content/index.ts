/**
 * Encyclopedia registry.
 *
 * The page renders from this list, not from markup, so adding an article is a
 * data change plus its copy. Nothing about the arithmetic lives here: every
 * number the encyclopedia shows is pulled at render time from `src/roulette`
 * and `src/sim`, which means the page cannot quietly disagree with the engine
 * that produced the numbers.
 *
 * The keys below are typed as `ArticleKey`, a union extracted from the English
 * dictionary rather than written out by hand. That direction is the whole point:
 * a registry entry pointing at a key nobody translated is a compile error
 * rather than a blank heading in production, and `es.ts` is already forced to
 * be a complete `Record<TranslationKey, string>`.
 */

import type { TranslationKey } from '../i18n/index.js'

/** Ids are the middle segment of every `art.<id>.<part>` dictionary key. */
export const ARTICLE_IDS = [
  'wheels',
  'bets',
  'edge',
  'systems',
  'fallacy',
  'measurement',
  'legitimacy',
] as const

export type EncyclopediaArticleId = (typeof ARTICLE_IDS)[number]

/**
 * Every dictionary key of the form `art.<known id>.<anything>`.
 *
 * The mapped type over `TranslationKey` means an id added to `ARTICLE_IDS` but
 * not to the dictionary contributes nothing, and a registry entry naming a key
 * the dictionary lacks cannot typecheck at all.
 */
export type ArticleKey = {
  [K in TranslationKey]: K extends `art.${EncyclopediaArticleId}.${string}` ? K : never
}[TranslationKey]

/**
 * Tables the page knows how to render. Each one is computed from the engine:
 *
 * - `wheelComparison` — pockets, zeros and house edge per variant.
 * - `betTable` — payout and coverage per bet kind, for the chosen variant.
 *
 * Declared as a union so an entry cannot name a table the renderer has never
 * heard of and fall through to nothing.
 */
export const TABLE_IDS = ['wheelComparison', 'betTable'] as const

export type EncyclopediaTableId = (typeof TABLE_IDS)[number]

export interface EncyclopediaArticle {
  readonly id: EncyclopediaArticleId
  /** `null` for a prose-only article. */
  readonly table: EncyclopediaTableId | null
  readonly title: ArticleKey
  readonly summary: ArticleKey
  readonly paragraphs: readonly ArticleKey[]
}

export const ARTICLES: readonly EncyclopediaArticle[] = [
  {
    id: 'wheels',
    table: 'wheelComparison',
    title: 'art.wheels.title',
    summary: 'art.wheels.summary',
    paragraphs: ['art.wheels.layout', 'art.wheels.green', 'art.wheels.ordering'],
  },
  {
    id: 'bets',
    table: 'betTable',
    title: 'art.bets.title',
    summary: 'art.bets.summary',
    paragraphs: ['art.bets.payout', 'art.bets.coverage', 'art.bets.stake'],
  },
  {
    id: 'edge',
    table: null,
    title: 'art.edge.title',
    summary: 'art.edge.summary',
    paragraphs: ['art.edge.zero', 'art.edge.uniformity', 'art.edge.same'],
  },
  {
    id: 'systems',
    table: null,
    title: 'art.systems.title',
    summary: 'art.systems.summary',
    paragraphs: ['art.systems.advance', 'art.systems.bankroll', 'art.systems.verdict'],
  },
  {
    id: 'fallacy',
    table: null,
    title: 'art.fallacy.title',
    summary: 'art.fallacy.summary',
    paragraphs: ['art.fallacy.independence', 'art.fallacy.streaks', 'art.fallacy.fairness'],
  },
  {
    id: 'measurement',
    table: null,
    title: 'art.measurement.title',
    summary: 'art.measurement.summary',
    paragraphs: ['art.measurement.derived', 'art.measurement.seeded', 'art.measurement.sampled'],
  },
  {
    id: 'legitimacy',
    table: null,
    title: 'art.legitimacy.title',
    summary: 'art.legitimacy.summary',
    paragraphs: [
      'art.legitimacy.noMoney',
      'art.legitimacy.noCoercion',
      'art.legitimacy.noPrediction',
    ],
  },
]

export function findArticle(id: string): EncyclopediaArticle | null {
  return ARTICLES.find((article) => article.id === id) ?? null
}