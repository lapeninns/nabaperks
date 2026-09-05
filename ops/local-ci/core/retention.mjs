/**
 * Which logs may be deleted.
 *
 * The run evidence on the Mac is the only copy of what the local plane
 * actually did. `agent.logRetentionDays` bounds how long it is kept, and this
 * module decides which entries have aged out - with two properties that matter
 * more than the arithmetic:
 *
 *   - The comparison is strict. An entry exactly on the boundary is retained.
 *     A deletion pass that runs a millisecond early and takes the evidence for
 *     a run still being argued about is worse than one that runs a day late.
 *   - A log belonging to a running job is never selected, whatever its age.
 *     A long run started before the cutoff would otherwise have its own log
 *     deleted out from under it mid-write.
 *
 * `now` is an argument. This module never reads the clock.
 */

import { LocalCiError, describeValue, toEpochMs } from "./contract.mjs"

/** Timestamp field every retention entry must carry. */
export const RETENTION_TIMESTAMP_FIELD = "createdAt"

/** Job statuses that protect an entry from deletion regardless of age. */
export const PROTECTED_STATUSES = Object.freeze(["running", "queued"])

export class RetentionError extends LocalCiError {}

function requireContractDays(contract) {
  if (
    typeof contract !== "object" ||
    contract === null ||
    typeof contract.agent !== "object" ||
    contract.agent === null
  ) {
    throw new RetentionError(
      "INVALID_CONTRACT",
      `retention requires the validated contract (received ${describeValue(contract)})`
    )
  }
  const days = contract.agent.logRetentionDays
  if (!Number.isInteger(days) || days < 1) {
    throw new RetentionError(
      "INVALID_CONTRACT",
      `contract.agent.logRetentionDays must be a positive integer (received ${describeValue(days)})`
    )
  }
  return days
}

/**
 * The instant before which an entry has aged out, in epoch milliseconds.
 * Exported so an operator diagnostic can print the same boundary the deletion
 * pass used rather than recomputing it a different way.
 */
export function retentionCutoff(now, contract) {
  const days = requireContractDays(contract)
  return toEpochMs(now, "now") - days * 24 * 60 * 60 * 1000
}

function entryLabel(entry, index) {
  if (typeof entry !== "object" || entry === null) return `entries[${index}]`
  return `entries[${index}] (${entry.path ?? entry.id ?? entry.jobId ?? "unnamed"})`
}

function entryTimestamp(entry, index) {
  const raw = entry[RETENTION_TIMESTAMP_FIELD]
  if (raw === undefined || raw === null) {
    throw new RetentionError(
      "MISSING_TIMESTAMP",
      `${entryLabel(entry, index)} has no ${RETENTION_TIMESTAMP_FIELD}; an entry with no age cannot be aged out safely`
    )
  }
  return toEpochMs(
    raw,
    `${entryLabel(entry, index)}.${RETENTION_TIMESTAMP_FIELD}`
  )
}

function protectedByRun(entry, runningJobIds) {
  if (entry.running === true) return true
  if (PROTECTED_STATUSES.includes(entry.status)) return true
  if (
    typeof entry.jobId === "string" &&
    entry.jobId !== "" &&
    runningJobIds.has(entry.jobId)
  ) {
    return true
  }
  return false
}

function normaliseEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new RetentionError(
      "INVALID_INPUT",
      `retention entries must be an array (received ${describeValue(entries)})`
    )
  }
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new RetentionError(
        "INVALID_INPUT",
        `${entryLabel(entry, index)} must be an object (received ${describeValue(entry)})`
      )
    }
  }
  return entries
}

function runningIdSet(options) {
  if (typeof options !== "object" || options === null) {
    throw new RetentionError(
      "INVALID_INPUT",
      `retention options must be an object (received ${describeValue(options)})`
    )
  }
  const ids = options.runningJobIds ?? []
  if (!Array.isArray(ids)) {
    throw new RetentionError(
      "INVALID_INPUT",
      `options.runningJobIds must be an array of job ids (received ${describeValue(ids)})`
    )
  }
  return new Set(ids)
}

/**
 * True when this entry is older than the retention window and nothing is still
 * writing to it.
 *
 * `entry` is `{ createdAt, path?|id?, jobId?, status?, running? }`.
 */
export function isExpired(entry, now, contract, options = {}) {
  normaliseEntries([entry])
  const cutoff = retentionCutoff(now, contract)
  const running = runningIdSet(options)
  if (protectedByRun(entry, running)) return false
  return entryTimestamp(entry, 0) < cutoff
}

/**
 * Split log entries into what may be deleted and what may not, with the
 * protected set called out separately.
 *
 * Returns `{ cutoff, expired, retained, protectedByRun }`, all arrays holding
 * the caller's own entry objects in input order.
 */
export function partitionLogs(entries, now, contract, options = {}) {
  normaliseEntries(entries)
  const cutoff = retentionCutoff(now, contract)
  const running = runningIdSet(options)

  const expired = []
  const retained = []
  const protectedEntries = []

  for (const [index, entry] of entries.entries()) {
    if (protectedByRun(entry, running)) {
      protectedEntries.push(entry)
      retained.push(entry)
      continue
    }
    // Strictly older. An entry sitting exactly on the boundary is kept.
    if (entryTimestamp(entry, index) < cutoff) {
      expired.push(entry)
    } else {
      retained.push(entry)
    }
  }

  return Object.freeze({
    cutoff,
    expired: Object.freeze(expired),
    retained: Object.freeze(retained),
    protectedByRun: Object.freeze(protectedEntries),
  })
}

/**
 * The entries a deletion pass may remove: strictly older than
 * `contract.agent.logRetentionDays`, and not belonging to a job that is still
 * queued or running.
 *
 * `options.runningJobIds` is the second way to protect an entry, for callers
 * whose entries carry a `jobId` but no status of their own.
 */
export function selectExpiredLogs(entries, now, contract, options = {}) {
  return partitionLogs(entries, now, contract, options).expired
}
