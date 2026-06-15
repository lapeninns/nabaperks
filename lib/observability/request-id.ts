// Request/trace id propagation. Edge-safe (no `server-only`): the proxy runs in
// the Edge runtime and mints or forwards a stable id so every log line, error
// report, and downstream call for a request can be correlated.

export const REQUEST_ID_HEADER = "x-request-id"

const VALID_ID = /^[A-Za-z0-9_.-]+$/
const MAX_ID_LENGTH = 200

/** A fresh RFC-4122 v4 id, available in both Edge and Node runtimes. */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

/** Trims and validates an inbound id, returning `null` if it is unusable. */
export function normalizeRequestId(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_ID_LENGTH) return null
  return VALID_ID.test(trimmed) ? trimmed : null
}

type HeaderSource = Pick<Headers, "get">

/** Reuses a valid inbound request id, or mints a new one when absent/invalid. */
export function resolveRequestId(headers: HeaderSource): string {
  return (
    normalizeRequestId(headers.get(REQUEST_ID_HEADER)) ?? generateRequestId()
  )
}
