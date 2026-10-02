import assert from "node:assert/strict"
import test from "node:test"

import {
  authHookEmailIdempotencyKey,
  authHookSmsChallengeDigest,
  smsHookChallengeWindowSeconds,
  parseAuthHookClaim,
} from "@/lib/auth/auth-hook-delivery-core"

test("claim parsing accepts only complete fenced states", () => {
  assert.deepEqual(parseAuthHookClaim({ status: "replay" }), {
    status: "replay",
  })
  assert.deepEqual(parseAuthHookClaim({ status: "busy" }), { status: "busy" })
  assert.deepEqual(
    parseAuthHookClaim({
      status: "claimed",
      lease_id: "b5d8731d-6809-4b29-8fef-73933c242f3c",
    }),
    {
      status: "claimed",
      leaseId: "b5d8731d-6809-4b29-8fef-73933c242f3c",
    }
  )

  for (const value of [
    null,
    { status: "concurrent" },
    { status: "claimed" },
    { status: "claimed", lease_id: "not-a-lease" },
  ]) {
    assert.equal(parseAuthHookClaim(value), null)
  }
})

test("SMS challenge identity survives envelope retries without storing phone or code", () => {
  const key = authHookSmsChallengeDigest(
    "fixture-secret",
    "+447700900111",
    "424242"
  )
  assert.equal(
    key,
    authHookSmsChallengeDigest("fixture-secret", "447700900111", "424242")
  )
  assert.match(key, /^[0-9a-f]{64}$/)
  assert.notEqual(
    key,
    authHookSmsChallengeDigest("fixture-secret", "+447700900112", "424242")
  )
  assert.notEqual(
    key,
    authHookSmsChallengeDigest("fixture-secret", "+447700900111", "424243")
  )
  assert.notEqual(
    key,
    authHookSmsChallengeDigest("other-secret", "+447700900111", "424242")
  )
})

test("SMS challenge lifetime defaults to GoTrue SMS expiry and rejects invalid configuration", () => {
  assert.equal(smsHookChallengeWindowSeconds(undefined), 60)
  assert.equal(smsHookChallengeWindowSeconds(""), 60)
  assert.equal(smsHookChallengeWindowSeconds("3600"), 3600)
  for (const invalid of ["0", "-1", "1.5", "1e3", "NaN", "86401"]) {
    assert.throws(() => smsHookChallengeWindowSeconds(invalid), /expiry/)
  }
})

test("email provider idempotency is stable and fixed length", () => {
  const first = authHookEmailIdempotencyKey("opaque-webhook-id")
  assert.equal(first, authHookEmailIdempotencyKey("opaque-webhook-id"))
  assert.notEqual(first, authHookEmailIdempotencyKey("another-webhook-id"))
  assert.match(first, /^auth-hook-email:[0-9a-f]{64}$/)
})
