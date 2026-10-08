import { runBatch } from './engine.js'
import type { BatchRequest, RunResult } from './engine.js'
import type { WorkerRequest, WorkerResponse } from './protocol.js'

/**
 * Page-side handle on the simulation.
 *
 * Falls back to running in-thread when `Worker` is missing, which happens
 * under some privacy extensions and in a few older mobile browsers. The
 * fallback is documented as a worse experience rather than hidden: it is the
 * same arithmetic, just on the thread that also has to paint.
 */

export interface SimulationHandle {
  run(batch: BatchRequest): Promise<RunResult[]>
  terminate(): void
  /** False when the batch ran on the main thread. Surfaced so the UI can say so. */
  readonly offThread: boolean
}

interface Pending {
  readonly resolve: (results: RunResult[]) => void
  readonly reject: (error: Error) => void
}

export function createSimulation(): SimulationHandle {
  if (typeof Worker !== 'function') {
    return {
      offThread: false,
      run: (batch) => Promise.resolve(runBatch(batch)),
      terminate: () => {},
    }
  }

  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
  const pending = new Map<number, Pending>()
  let nextId = 1

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const waiter = pending.get(response.id)
    if (waiter === undefined) return
    pending.delete(response.id)
    if (response.type === 'result') waiter.resolve([...response.results])
    else waiter.reject(new Error(response.message))
  })

  worker.addEventListener('error', (event) => {
    const error = new Error(event.message || 'simulation worker failed')
    for (const waiter of pending.values()) waiter.reject(error)
    pending.clear()
  })

  return {
    offThread: true,
    run: (batch) =>
      new Promise<RunResult[]>((resolve, reject) => {
        const id = nextId
        nextId += 1
        pending.set(id, { resolve, reject })
        const request: WorkerRequest = { type: 'run', id, batch }
        worker.postMessage(request)
      }),
    terminate: () => {
      for (const waiter of pending.values()) waiter.reject(new Error('simulation terminated'))
      pending.clear()
      worker.terminate()
    },
  }
}