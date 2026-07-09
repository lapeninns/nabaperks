/**
 * Pure drain-budget decisions for the push delivery worker
 * (MS-notifications-drain-throughput). No server-only imports — the unit
 * tier exercises this module directly.
 *
 * The worker claims batches via claim_due_notification_events, which clamps
 * its p_limit to 1..500 in SQL; resolveDrainOptions mirrors that window so a
 * requested batch is never silently reduced server-side.
 */

export const CLAIM_BATCH_MIN = 1
export const CLAIM_BATCH_MAX = 500
export const DRAIN_MAX_EVENTS_CAP = 5_000
export const DEFAULT_CLAIM_BATCH_SIZE = 50

export type DrainOptionsInput = {
  readonly batchSize?: number
  readonly maxEvents?: number
  readonly timeBudgetMs?: number | null
}

export type DrainOptions = {
  readonly batchSize: number
  readonly maxEvents: number
  readonly timeBudgetMs: number | null
}

export type DrainState = {
  readonly processed: number
  readonly lastBatchSize: number
}

export function resolveDrainOptions(
  input: DrainOptionsInput = {}
): DrainOptions {
  const batchSize = clampInt(
    input.batchSize,
    CLAIM_BATCH_MIN,
    CLAIM_BATCH_MAX,
    DEFAULT_CLAIM_BATCH_SIZE
  )
  // A run always affords at least one full batch; the cap keeps a single
  // invocation bounded no matter what the caller asks for.
  const maxEvents = Math.min(
    DRAIN_MAX_EVENTS_CAP,
    Math.max(
      batchSize,
      clampInt(input.maxEvents, 1, DRAIN_MAX_EVENTS_CAP, batchSize)
    )
  )
  return {
    batchSize,
    maxEvents,
    timeBudgetMs: normalizeTimeBudget(input.timeBudgetMs),
  }
}

/**
 * Decides whether the worker claims another batch. Exit conditions, in
 * order: a batch shorter than requested means the due queue is drained; a
 * spent event budget stops the run; a spent soft time budget stops the run.
 */
export function shouldContinueDraining(
  state: DrainState,
  options: DrainOptions,
  elapsedMs: number
): boolean {
  if (state.lastBatchSize < options.batchSize) return false
  return shouldProcessNextEvent(state.processed, options, elapsedMs)
}

export function shouldProcessNextEvent(
  processed: number,
  options: DrainOptions,
  elapsedMs: number
): boolean {
  if (processed >= options.maxEvents) return false
  if (options.timeBudgetMs !== null && elapsedMs >= options.timeBudgetMs) {
    return false
  }
  return true
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function normalizeTimeBudget(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return Math.floor(value)
}
