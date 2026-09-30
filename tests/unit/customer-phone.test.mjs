import assert from "node:assert/strict"
import { test } from "node:test"

const { normalizePhone } = await import("@/lib/customer/phone")

test("Given a valid GB mobile When it is normalized Then it is accepted", () => {
  const result = normalizePhone("07400 123456")

  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.phone.country, "GB")
})

test("Given a valid non-GB phone When it is normalized Then it is rejected before dispatch", () => {
  const result = normalizePhone("+1 202 555 0123")

  assert.deepEqual(result, {
    ok: false,
    error: "Enter a UK mobile number, like 07700 900123.",
  })
})

for (const input of [
  "07400123456",
  "447400123456",
  "+447400123456",
  "44 7400 123456",
  "+44 7400 123456",
  "00447400123456",
  "+44 (0)7400 123456",
]) {
  test(`Given UK mobile ${input} When normalized Then all prefixes identify the same phone`, () => {
    assert.deepEqual(normalizePhone(input), {
      ok: true,
      phone: { e164: "+447400123456", country: "GB", last4: "3456" },
    })
  })
}

for (const input of ["020 7946 0018", "442079460018", "+442079460018"]) {
  test(`Given UK landline ${input} When normalized Then it is accepted`, () => {
    assert.deepEqual(normalizePhone(input), {
      ok: true,
      phone: { e164: "+442079460018", country: "GB", last4: "0018" },
    })
  })
}

for (const country of ["US", "NP", "IN"]) {
  for (const input of ["07400123456", "447400123456", "+447400123456"]) {
    test(`Given legacy country hint ${country} When UK phone ${input} is normalized Then UK parsing stays authoritative`, () => {
      assert.deepEqual(normalizePhone(input, country), {
        ok: true,
        phone: { e164: "+447400123456", country: "GB", last4: "3456" },
      })
    })
  }
}

for (const input of ["0", "44", "+44", "07400123", "call 07400 123456"]) {
  test(`Given invalid phone ${input} When normalized Then it is rejected`, () => {
    assert.deepEqual(normalizePhone(input), {
      ok: false,
      error: "Enter a UK mobile number, like 07700 900123.",
    })
  })
}
