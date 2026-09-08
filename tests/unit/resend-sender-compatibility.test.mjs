import assert from "node:assert/strict"
import { test } from "node:test"
import { sendWithSenderCompatibility } from "@/lib/notifications/resend-sender-compatibility"

for (const [status, name] of [
  [409, "concurrent_idempotent_requests"],
  [429, "rate_limit_exceeded"],
  [500, "internal_server_error"],
  [409, "unknown"],
]) {
  test(`sender replay does not reinterpret ${status}/${name}`, async () => {
    const calls = []
    const response = await sendWithSenderCompatibility({
      sender: "new@example.test",
      legacySender: "old@example.test",
      idempotencyKey: "same",
      send: async (sender) => {
        calls.push(sender)
        return Response.json({ name }, { status })
      },
    })
    assert.equal(response.status, status)
    assert.deepEqual(calls, ["new@example.test"])
  })
}

test("sender mismatch replay is bounded and runs the worker's pacing hook", async () => {
  const calls = []
  const response = await sendWithSenderCompatibility({
    sender: "new@example.test",
    legacySender: "old@example.test",
    idempotencyKey: "same",
    send: async (sender) => {
      calls.push(sender)
      return Response.json(
        { name: "invalid_idempotent_request" },
        { status: 409 }
      )
    },
    beforeLegacyAttempt: async () => {
      calls.push("paced")
    },
  })
  assert.equal(response.status, 409)
  assert.deepEqual(calls, ["new@example.test", "paced", "old@example.test"])
})

test("unkeyed messages and unchanged senders never enter legacy replay", async () => {
  for (const options of [
    { sender: "new", legacySender: "old" },
    { sender: "same", legacySender: "same", idempotencyKey: "key" },
  ]) {
    let calls = 0
    await sendWithSenderCompatibility({
      ...options,
      send: async () => {
        calls++
        return Response.json(
          { name: "invalid_idempotent_request" },
          { status: 409 }
        )
      },
    })
    assert.equal(calls, 1)
  }
})
