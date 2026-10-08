import type { RunResult } from './engine.js'
import type { BatchRequest } from './engine.js'

/**
 * The wire format between the page and its Worker.
 *
 * Separate from `worker.ts` on purpose. The page needs these types, and
 * `import type` would erase them so the module body never runs — but that
 * correctness depends on nobody later importing them as values, which is a
 * silent, catastrophic failure if they do. A types-only module has no such
 * failure mode.
 */

export type WorkerRequest = {
  readonly type: 'run'
  /** Echoed back so a page that fires several runs can match replies. */
  readonly id: number
  readonly batch: BatchRequest
}

export type WorkerResponse =
  | { readonly type: 'result'; readonly id: number; readonly results: readonly RunResult[] }
  | { readonly type: 'error'; readonly id: number; readonly message: string }