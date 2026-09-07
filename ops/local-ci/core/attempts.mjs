/** Durable host-owned attempts. Candidate workspaces must never contain this file. */
import { randomUUID } from "node:crypto"
import {
  mkdirSync,
  readFileSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  renameSync,
  unlinkSync,
} from "node:fs"
import { dirname } from "node:path"
import { jobKey } from "./queue.mjs"

const attemptKey = (job) => `${jobKey(job)} ${job.scope ?? "commit"}`

const SCHEMA = "nabaperks.local-ci-attempts.v1"
const STATES = new Set([
  "running",
  "interrupted",
  "success",
  "failure",
  "timed_out",
  "incomplete",
  "cancelled",
  "superseded",
])
const RETRYABLE = new Set([
  "interrupted",
  "incomplete",
  "timed_out",
  "cancelled",
])

function validate(value) {
  if (value?.schema !== SCHEMA || !Array.isArray(value.attempts))
    throw new Error("Invalid local CI attempt journal")
  const ids = new Set()
  const counts = new Map()
  for (const entry of value.attempts) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      ids.has(entry.id) ||
      typeof entry.ref !== "string" ||
      !entry.ref ||
      !/^[a-f0-9]{40}$/.test(entry.sha) ||
      !["pr", "main", "nightly"].includes(entry.profile) ||
      !STATES.has(entry.status) ||
      !Number.isInteger(entry.number) ||
      entry.number < 1 ||
      !Number.isFinite(Date.parse(entry.startedAt)) ||
      typeof entry.published !== "boolean" ||
      (entry.creationAttempted !== undefined &&
        typeof entry.creationAttempted !== "boolean") ||
      (entry.publish !== undefined && typeof entry.publish !== "boolean") ||
      (entry.scope !== undefined &&
        (typeof entry.scope !== "string" || !entry.scope)) ||
      (entry.checkRunId !== null &&
        (!Number.isSafeInteger(entry.checkRunId) || entry.checkRunId < 1))
    ) {
      throw new Error("Invalid local CI attempt journal entry")
    }
    const key = attemptKey(entry)
    const expectedNumber = (counts.get(key) ?? 0) + 1
    if (
      entry.number !== expectedNumber ||
      (entry.status === "running" &&
        (entry.completedAt !== null || entry.published)) ||
      (entry.status !== "running" &&
        (!Number.isFinite(Date.parse(entry.completedAt)) ||
          Date.parse(entry.completedAt) < Date.parse(entry.startedAt))) ||
      (entry.status === "success" && entry.record?.conclusion !== "success") ||
      (entry.record !== null &&
        (entry.record?.headSha !== entry.sha ||
          entry.record?.profile !== entry.profile))
    ) {
      throw new Error("Inconsistent local CI attempt journal evidence")
    }
    counts.set(key, expectedNumber)
    ids.add(entry.id)
  }
  return value
}

/** Replace atomically and fsync both contents and directory before permitting work. */
export function writeAttemptJournal(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  let descriptor
  try {
    descriptor = openSync(temporary, "wx", 0o600)
    writeFileSync(descriptor, `${JSON.stringify(value)}\n`)
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, path)
    const directory = openSync(dirname(path), "r")
    try {
      fsyncSync(directory)
    } finally {
      closeSync(directory)
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    try {
      unlinkSync(temporary)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
}

export function createAttemptJournal({
  path,
  now = () => Date.now(),
  maxAttempts = 2,
  retryDelayMs = 60_000,
  write = writeAttemptJournal,
}) {
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    !Number.isFinite(retryDelayMs) ||
    retryDelayMs < 0
  )
    throw new Error("Invalid attempt retry policy")
  let state = { schema: SCHEMA, attempts: [] }
  let poisoned = false
  const publications = new Set()
  try {
    state = validate(JSON.parse(readFileSync(path, "utf8")))
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  const persist = (attempts) => {
    if (poisoned)
      throw new Error("Attempt journal persistence failed; restart required")
    const next = validate({ schema: SCHEMA, attempts })
    try {
      write(path, next)
    } catch (error) {
      poisoned = true
      throw error
    }
    state = next
  }
  const instant = () => new Date(now()).toISOString()
  if (state.attempts.some((entry) => entry.status === "running")) {
    persist(
      state.attempts.map((entry) =>
        entry.status === "running"
          ? {
              ...entry,
              status: "interrupted",
              completedAt: instant(),
              published: entry.publish === false,
            }
          : entry
      )
    )
  }
  const matching = (job) =>
    state.attempts.filter((entry) => attemptKey(entry) === attemptKey(job))
  const eligible = (job) => {
    if (poisoned)
      throw new Error("Attempt journal persistence failed; restart required")
    const attempts = matching(job)
    if (!attempts.length) return true
    const last = attempts.at(-1)
    return (
      attempts.length < maxAttempts &&
      RETRYABLE.has(last.status) &&
      last.published &&
      now() - Date.parse(last.completedAt) >= retryDelayMs
    )
  }
  const update = (id, fields) => {
    if (!state.attempts.some((entry) => entry.id === id))
      throw new Error("Unknown local CI attempt")
    persist(
      state.attempts.map((entry) =>
        entry.id === id ? { ...entry, ...fields } : entry
      )
    )
  }
  return Object.freeze({
    get entries() {
      return structuredClone(state.attempts)
    },
    eligible,
    begin(job) {
      if (!eligible(job)) throw new Error("Local CI attempt is not eligible")
      const entry = {
        id: randomUUID(),
        ref: job.ref,
        sha: job.sha.toLowerCase(),
        profile: job.profile,
        scope: job.scope ?? "commit",
        publish: job.publish !== false,
        number: matching(job).length + 1,
        status: "running",
        startedAt: instant(),
        completedAt: null,
        checkRunId: null,
        creationAttempted: false,
        published: false,
        record: null,
      }
      persist([...state.attempts, entry])
      return entry.id
    },
    markCreationAttempted(id) {
      update(id, { creationAttempted: true })
    },
    attachCheck(id, checkRunId) {
      update(id, { checkRunId })
    },
    finish(id, status, record = null) {
      if (!STATES.has(status) || status === "running")
        throw new Error("Invalid attempt outcome")
      const entry = state.attempts.find((entry) => entry.id === id)
      update(id, {
        status,
        record,
        completedAt: instant(),
        published: entry?.publish === false,
      })
    },
    claimPublication(id) {
      const entry = state.attempts.find((entry) => entry.id === id)
      if (
        !entry ||
        entry.status === "running" ||
        entry.publish === false ||
        entry.published ||
        publications.has(id)
      )
        return false
      publications.add(id)
      return true
    },
    releasePublication(id) {
      publications.delete(id)
    },
    published(id) {
      update(id, { published: true })
    },
  })
}

/** Coordinate the watcher and nightly outbox without duplicate concurrent publication. */
export async function publishAttempt(
  journal,
  id,
  publish,
  stillOwned = () => true
) {
  if (!journal.claimPublication(id)) return false
  try {
    const entry = journal.entries.find((entry) => entry.id === id)
    if ((await publish(entry)) === false) return false
    if (!stillOwned()) return false
    journal.published(id)
    return true
  } finally {
    journal.releasePublication(id)
  }
}
