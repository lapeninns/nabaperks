import assert from "node:assert/strict"
import { test } from "node:test"
import { sendWithPayloadCompatibility } from "@/lib/notifications/resend-payload-compatibility"

for (const [status, name] of [
  [409, "concurrent_idempotent_requests"],
  [429, "rate_limit_exceeded"],
  [500, "internal_server_error"],
  [409, "unknown"],
]) {
  test(`sender replay does not reinterpret ${status}/${name}`, async () => {
    const calls = []
    const response = await sendWithPayloadCompatibility({
      payload: { from: "new@example.test" },
      legacySender: "old@example.test",
      idempotencyKey: "same",
      send: async (sender) => {
        calls.push(sender.from)
        return Response.json({ name }, { status })
      },
    })
    assert.equal(response.status, status)
    assert.deepEqual(calls, ["new@example.test"])
  })
}

test("sender mismatch replay is bounded and runs the worker's pacing hook", async () => {
  const calls = []
  const response = await sendWithPayloadCompatibility({
    payload: { from: "new@example.test" },
    legacySender: "old@example.test",
    idempotencyKey: "same",
    send: async (sender) => {
      calls.push(sender.from)
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

test("unkeyed messages and unchanged payloads never enter legacy replay", async () => {
  for (const options of [
    { payload: { from: "new" }, legacySender: "old" },
    { payload: { from: "same" }, legacySender: "same", idempotencyKey: "key" },
  ]) {
    let calls = 0
    await sendWithPayloadCompatibility({
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

for (const sender of ["old@example.test", "marketing@example.test"]) {
  test(`accepted legacy payload is replayed exactly with current sender ${sender}`, async () => {
    const legacy = {
      from: "old@example.test",
      to: ["recipient@example.test"],
      subject: "Invite",
      text: "Original text",
      html: "<p>Original text</p>",
      attachments: [{ filename: "invite.txt", content: "aW52aXRl" }],
    }
    const calls = []
    const response = await sendWithPayloadCompatibility({
      payload: {
        ...legacy,
        from: sender,
        reply_to: "support@example.test",
        headers: { "List-Unsubscribe": "<https://example.test/unsubscribe>" },
      },
      legacySender: legacy.from,
      idempotencyKey: "original-key",
      send: async (payload) => {
        calls.push(payload)
        return JSON.stringify(payload) === JSON.stringify(legacy)
          ? Response.json({ id: "original-provider-id" })
          : Response.json(
              { name: "invalid_idempotent_request" },
              { status: 409 }
            )
      },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: "original-provider-id" })
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[1], legacy)
  })
}
