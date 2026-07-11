import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

const { verifyCustomerPhoneChallenge } =
  await import("@/lib/security/turnstile")

afterEach(() => {
  mock.restoreAll()
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  delete process.env.TURNSTILE_SECRET_KEY
  delete process.env.VERCEL_ENV
})

test("a hosted deployment without challenge keys fails closed", async () => {
  process.env.VERCEL_ENV = "preview"

  assert.deepEqual(
    await verifyCustomerPhoneChallenge({ token: "", remoteIp: "192.0.2.1" }),
    { status: "rejected" }
  )
})

test("an unconfigured local challenge does not block OTP development", async () => {
  assert.deepEqual(
    await verifyCustomerPhoneChallenge({ token: "", remoteIp: "127.0.0.1" }),
    { status: "not_configured" }
  )
})

test("a partially configured challenge fails closed before provider dispatch", async () => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"
  mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, action: "customer_phone_otp" })
  )

  assert.deepEqual(
    await verifyCustomerPhoneChallenge({
      token: "token",
      remoteIp: "192.0.2.1",
    }),
    { status: "rejected" }
  )
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test("a configured challenge requires Siteverify success and the OTP action", async () => {
  configureChallenge()
  mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, action: "customer_phone_otp" })
  )

  assert.deepEqual(
    await verifyCustomerPhoneChallenge({
      token: "token",
      remoteIp: "192.0.2.1",
    }),
    { status: "verified" }
  )
})

test("a forged or wrong-action challenge fails closed", async () => {
  configureChallenge()
  mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, action: "another_form" })
  )

  assert.deepEqual(
    await verifyCustomerPhoneChallenge({
      token: "token",
      remoteIp: "192.0.2.1",
    }),
    { status: "rejected" }
  )
})

function configureChallenge() {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"
  process.env.TURNSTILE_SECRET_KEY = "secret-key"
}
