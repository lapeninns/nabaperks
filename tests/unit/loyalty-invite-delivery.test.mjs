import assert from "node:assert/strict"
import { test } from "node:test"

const {
  classifySendFailure,
  shouldRetrySend,
  nextRetryDelayMs,
  nextRetryDueAtMs,
  inviteIdempotencyKey,
} = await import("@/lib/loyalty-invites/delivery-core")

/** Retry classification, backoff schedule and per-recipient idempotency. */

test("only network / 429 / 5xx are transient", () => {
  assert.equal(classifySendFailure(null), "transient")
  assert.equal(classifySendFailure(429), "transient")
  assert.equal(classifySendFailure(500), "transient")
  assert.equal(classifySendFailure(503), "transient")
  assert.equal(classifySendFailure(400), "permanent")
  assert.equal(classifySendFailure(404), "permanent")
  assert.equal(classifySendFailure(422), "permanent")
})

test("retries transient failures up to three total attempts", () => {
  assert.equal(shouldRetrySend(1, 500), true)
  assert.equal(shouldRetrySend(2, 429), true)
  assert.equal(shouldRetrySend(3, 500), false, "third attempt is the last")
  assert.equal(shouldRetrySend(1, 400), false, "permanent never retries")
})

test("backoff is 15 minutes then two hours", () => {
  assert.equal(nextRetryDelayMs(1), 15 * 60 * 1000)
  assert.equal(nextRetryDelayMs(2), 2 * 60 * 60 * 1000)
  assert.equal(nextRetryDelayMs(3), null)
})

test("next-due time combines backoff with the retry decision", () => {
  assert.equal(nextRetryDueAtMs(1, 500, 1_000), 1_000 + 15 * 60 * 1000)
  assert.equal(nextRetryDueAtMs(1, 400, 1_000), null)
  assert.equal(nextRetryDueAtMs(3, 500, 1_000), null)
})

test("idempotency key is stable per recipient", () => {
  assert.equal(inviteIdempotencyKey("rec-1"), "loyalty-invite:rec-1")
  assert.equal(inviteIdempotencyKey("rec-1"), inviteIdempotencyKey("rec-1"))
  assert.notEqual(inviteIdempotencyKey("rec-1"), inviteIdempotencyKey("rec-2"))
})
