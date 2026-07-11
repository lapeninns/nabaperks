import assert from "node:assert/strict"
import { test } from "node:test"

const { normalizePhone } = await import("@/lib/customer/phone")

test("Given a valid GB mobile When it is normalized Then it is accepted", () => {
  const result = normalizePhone("07400 123456", "GB")

  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.phone.country, "GB")
})

test("Given a valid non-GB phone When it is normalized Then it is rejected before dispatch", () => {
  const result = normalizePhone("+1 202 555 0123", "GB")

  assert.deepEqual(result, {
    ok: false,
    error: "Enter a UK phone number.",
  })
})
