import assert from "node:assert/strict"
import test from "node:test"

import {
  authHookEmailIdempotencyKey,
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

test("email provider idempotency is stable and fixed length", () => {
  const first = authHookEmailIdempotencyKey("opaque-webhook-id", "lease-1")
  assert.equal(
    first,
    authHookEmailIdempotencyKey("opaque-webhook-id", "lease-1")
  )
  assert.notEqual(
    first,
    authHookEmailIdempotencyKey("opaque-webhook-id", "lease-2")
  )
  assert.match(first, /^auth-hook-email:[0-9a-f]{64}$/)
})
