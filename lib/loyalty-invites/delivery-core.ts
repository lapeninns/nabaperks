import {
  LOYALTY_INVITE_RETRY_BACKOFFS_MS,
  LOYALTY_INVITE_SEND_MAX_ATTEMPTS,
} from "@/lib/loyalty-invites/constants"

/**
 * Pure delivery-classification helpers for the invitation drain worker (no
 * server-only, no Supabase — unit-tested directly). They decide whether a
 * Resend send failure should be retried and when, and produce the stable
 * per-recipient idempotency key.
 */

export type SendFailureKind = "transient" | "permanent"

/**
 * Only network errors (`status === null`), 429 rate-limits and 5xx server
 * errors are transient. Everything else — a 4xx such as an invalid or
 * previously-bounced address — is a permanent failure that must not be retried.
 */
export function classifySendFailure(status: number | null): SendFailureKind {
  if (status === null) return "transient"
  if (status === 429) return "transient"
  if (status >= 500 && status <= 599) return "transient"
  return "permanent"
}

/**
 * Given the attempt that just failed (1-based) and its HTTP status, decide
 * whether another attempt is allowed. Three total attempts, transient only.
 */
export function shouldRetrySend(
  attemptNumber: number,
  status: number | null
): boolean {
  if (attemptNumber >= LOYALTY_INVITE_SEND_MAX_ATTEMPTS) return false
  return classifySendFailure(status) === "transient"
}

/**
 * Backoff before the next attempt: 15 minutes after the first failure, two
 * hours after the second. Returns null when no further attempt is scheduled.
 */
export function nextRetryDelayMs(attemptNumber: number): number | null {
  const index = attemptNumber - 1
  if (index < 0 || index >= LOYALTY_INVITE_RETRY_BACKOFFS_MS.length) return null
  return LOYALTY_INVITE_RETRY_BACKOFFS_MS[index]
}

/** Absolute next-attempt time, or null when retries are exhausted. */
export function nextRetryDueAtMs(
  attemptNumber: number,
  status: number | null,
  nowMs: number
): number | null {
  if (!shouldRetrySend(attemptNumber, status)) return null
  const delay = nextRetryDelayMs(attemptNumber)
  return delay === null ? null : nowMs + delay
}

/**
 * A stable per-recipient Resend idempotency key. Resend retains keys for 24
 * hours, which comfortably covers the 15-minute + two-hour retry window, so
 * replays of the same recipient never double-send while distinct recipients are
 * never collapsed.
 */
export function inviteIdempotencyKey(recipientId: string): string {
  return `loyalty-invite:${recipientId}`
}
