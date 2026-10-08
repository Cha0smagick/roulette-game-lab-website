import { runBatch } from './engine.js'
import type { WorkerRequest, WorkerResponse } from './protocol.js'

/**
 * The simulation Worker.
 *
 * The batch is the only genuinely heavy thing in the product. Eight systems
 * over a million spins each is several million rounds of arithmetic, and on the
 * main thread that is a frozen tab, a grey spinner and a back gesture. In a
 * Worker the page stays scrollable and the run can be abandoned.
 *
 * Everything it needs is passed in the message. It holds no state between
 * messages, so a stale reply from an abandoned run cannot corrupt a later one.
 */

/**
 * The Worker scope, described by hand.
 *
 * `DedicatedWorkerGlobalScope` lives in TypeScript's `WebWorker` lib, and that
 * lib cannot be enabled alongside `DOM` without redeclaring half the global
 * surface. This module genuinely only needs these two members, so it states
 * them rather than dragging in a second universe of type declarations.
 */
interface WorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ): void
  postMessage(message: WorkerResponse): void
}

const scope = self as unknown as WorkerScope

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type !== 'run') return
  try {
    const response: WorkerResponse = {
      type: 'result',
      id: request.id,
      results: runBatch(request.batch),
    }
    scope.postMessage(response)
  } catch (error) {
    // A rejected promise here would surface as a Worker that silently stops
    // answering, which the page can only show as an endless spinner.
    const response: WorkerResponse = {
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    }
    scope.postMessage(response)
  }
})