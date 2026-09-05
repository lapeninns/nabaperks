/**
 * The agent-liveness heartbeat.
 *
 * The failure this exists to catch is the quiet one. A local CI plane that has
 * stopped polling produces no failing check, no red lane and no alert - it
 * simply never reports, and every pull request waits for a bridge that will
 * time out two hours later. The heartbeat inverts that: the monitor alerts on
 * *silence*, so an agent that dies, a Mac that never wakes and a VM that
 * failed to start all surface the same way and within minutes.
 *
 * The URL is a host secret. Its path segment is the whole credential - anyone
 * holding it can silence the alarm - so it is never logged, never passed as a
 * process argument, and never rendered into a check summary. `describeUrl`
 * exists precisely so a log line can say which monitor was pinged without
 * saying how to ping it.
 *
 * `fetch` and `now` are injected, so every branch is exercised offline.
 */

import { LocalCiError, describeValue, toEpochMs } from "../core/contract.mjs"

export class HeartbeatError extends LocalCiError {}

/** A heartbeat must never hold up a poll tick; this is a hard ceiling. */
export const HEARTBEAT_TIMEOUT_MS = 10_000

/** Consecutive failures tolerated before the agent logs at error level. */
export const HEARTBEAT_FAILURE_THRESHOLD = 3

/**
 * True for a well-formed HTTPS heartbeat URL. Pure.
 *
 * Plain HTTP is refused: the path segment is the credential, and sending it in
 * clear text over the operator's network hands it to anyone on that network.
 */
export function isHeartbeatUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false
  let parsed
  try {
    parsed = new URL(value.trim())
  } catch {
    return false
  }
  return parsed.protocol === "https:"
}

/** The heartbeat cadence in milliseconds, from the contract. Pure. */
export function heartbeatIntervalMs(contract) {
  const minutes = contract?.agent?.heartbeatIntervalMinutes
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw new HeartbeatError(
      "INVALID_CONTRACT",
      `contract.agent.heartbeatIntervalMinutes must be a positive finite number (received ${describeValue(minutes)})`
    )
  }
  return Math.round(minutes * 60_000)
}

/**
 * Whether a heartbeat is due. Pure: `now` and `lastSentAt` are arguments, so
 * the cadence is testable without waiting five minutes.
 *
 * A null `lastSentAt` is always due - the first tick after a restart should
 * report immediately rather than leave the monitor guessing for one interval.
 */
export function shouldSendHeartbeat({ lastSentAt = null, now, contract }) {
  const interval = heartbeatIntervalMs(contract)
  if (lastSentAt === null || lastSentAt === undefined) return true
  return toEpochMs(now, "now") - toEpochMs(lastSentAt, "lastSentAt") >= interval
}

/**
 * A loggable description of a heartbeat URL: origin only, path replaced. Pure.
 *
 * `https://heartbeat.example.test/abc123` becomes
 * `https://heartbeat.example.test/[redacted]`.
 */
export function describeUrl(value) {
  if (typeof value !== "string" || value === "") return "[unset]"
  try {
    const parsed = new URL(value)
    return `${parsed.origin}/[redacted]`
  } catch {
    return "[unparseable]"
  }
}

/**
 * The heartbeat sender. **Impure** - it makes a network request.
 *
 * `ping` never throws: a monitoring endpoint being unreachable is not a reason
 * to fail a CI run, and the monitor's own silence alarm is the backstop for a
 * heartbeat that stops arriving. It returns a result record instead, so the
 * caller can log the failure and carry on.
 */
export function createHeartbeat({
  url,
  contract,
  fetch = globalThis.fetch,
  now = () => Date.now(),
  logger = null,
  timeoutMs = HEARTBEAT_TIMEOUT_MS,
} = {}) {
  heartbeatIntervalMs(contract)
  const enabled = url !== null && url !== undefined && url !== ""
  if (enabled && !isHeartbeatUrl(url)) {
    throw new HeartbeatError(
      "INVALID_HEARTBEAT_URL",
      "the heartbeat URL must be an absolute https:// URL; the path segment is the credential and plain HTTP would publish it to the local network"
    )
  }
  if (enabled && typeof fetch !== "function") {
    throw new HeartbeatError(
      "MISSING_FETCH",
      "createHeartbeat needs a fetch implementation; this Node build has no global fetch and none was injected"
    )
  }

  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }

  let lastSentAt = null
  let consecutiveFailures = 0

  return Object.freeze({
    enabled,
    description: describeUrl(url ?? ""),
    get lastSentAt() {
      return lastSentAt
    },
    get consecutiveFailures() {
      return consecutiveFailures
    },

    /**
     * Send the heartbeat when it is due, or report why it was not sent.
     *
     * Returns `{ sent, reason, status? }`. Never throws.
     */
    async ping({ force = false } = {}) {
      if (!enabled) {
        return Object.freeze({
          sent: false,
          reason: "no heartbeat URL is configured on this host",
        })
      }
      const instant = now()
      if (
        !force &&
        !shouldSendHeartbeat({ lastSentAt, now: instant, contract })
      ) {
        return Object.freeze({ sent: false, reason: "not due yet" })
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      timer.unref?.()
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: { "user-agent": "nabaperks-local-ci-agent" },
        })
        if (!response.ok) {
          consecutiveFailures += 1
          log(
            consecutiveFailures >= HEARTBEAT_FAILURE_THRESHOLD
              ? "error"
              : "warn",
            `heartbeat to ${describeUrl(url)} returned HTTP ${response.status} (${consecutiveFailures} consecutive failures)`
          )
          return Object.freeze({
            sent: false,
            reason: `HTTP ${response.status}`,
            status: response.status,
          })
        }
        lastSentAt = instant
        consecutiveFailures = 0
        return Object.freeze({
          sent: true,
          reason: "ok",
          status: response.status,
        })
      } catch (error) {
        consecutiveFailures += 1
        // The message is the agent's own, not the error's: a fetch failure can
        // echo the request URL, and that URL is the credential.
        log(
          consecutiveFailures >= HEARTBEAT_FAILURE_THRESHOLD ? "error" : "warn",
          `heartbeat to ${describeUrl(url)} failed (${error.name}); ${consecutiveFailures} consecutive failures`
        )
        return Object.freeze({ sent: false, reason: error.name })
      } finally {
        clearTimeout(timer)
      }
    },
  })
}
