import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

const PHONE = "+447700900123"
const CODE = "424242"
const DELIVERY_SECRET = "N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?x"
const { checkCustomerPhoneVerification, startCustomerPhoneVerification } =
  await import("@/lib/customer/verification")
const { deliveryDestinationFingerprint } =
  await import("@/lib/notifications/non-production-delivery-policy")

afterEach(() => {
  mock.restoreAll()
  delete process.env.VERCEL_ENV
  delete process.env.VERCEL_TARGET_ENV
  delete process.env.NON_PRODUCTION_DELIVERY_HMAC_SECRET
  delete process.env.NON_PRODUCTION_DELIVERY_ALLOWLIST
})

test("Given Twilio approves a code When verification runs Then it returns approved with a bounded signal", async () => {
  let signal
  mock.method(globalThis, "fetch", async (_url, init) => {
    signal = init?.signal
    return Response.json({ status: "approved" })
  })
  configureProvider()
  const result = await checkCustomerPhoneVerification(PHONE, CODE)

  assert.deepEqual(result, { status: "approved" })
  assert.ok(signal instanceof AbortSignal)
})

test("Given Twilio rejects a code When verification runs Then it returns rejected", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "pending" })
  )
  configureProvider()
  const result = await checkCustomerPhoneVerification(PHONE, CODE)

  assert.deepEqual(result, { status: "rejected" })
})

test("Given Twilio rejects a verification check at HTTP level When verification runs Then it stays an inline rejected code", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("not found", { status: 404 })
  )
  configureProvider()
  const result = await checkCustomerPhoneVerification(PHONE, CODE)

  assert.deepEqual(result, { status: "rejected" })
})

test("Given Twilio rate limits a request When verification starts Then it returns unavailable", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("limited", { status: 429 })
  )
  configureProvider()
  const result = await startCustomerPhoneVerification(PHONE)

  assert.deepEqual(result, { status: "unavailable" })
})

test("Given Twilio returns a server failure When verification starts Then it returns unavailable", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("upstream unavailable", { status: 503 })
  )
  configureProvider()
  const result = await startCustomerPhoneVerification(PHONE)

  assert.deepEqual(result, { status: "unavailable" })
})

test("Given Twilio times out When verification runs Then it returns unavailable", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Timed out", "TimeoutError")
  })
  configureProvider()
  const result = await checkCustomerPhoneVerification(PHONE, CODE)

  assert.deepEqual(result, { status: "unavailable" })
})

test("Given the provider network fails When verification runs Then it returns unavailable", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network unavailable")
  })
  configureProvider()
  const result = await checkCustomerPhoneVerification(PHONE, CODE)

  assert.deepEqual(result, { status: "unavailable" })
})

test("Given malformed provider JSON When verification runs Then it returns unavailable", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("not-json", { status: 200 })
  )
  configureProvider()
  const result = await checkCustomerPhoneVerification(PHONE, CODE)

  assert.deepEqual(result, { status: "unavailable" })
})

test("Given Preview and a dev OTP When the phone is not approved Then no bypass or provider send occurs", async () => {
  configureProvider()
  process.env.VERCEL_ENV = "preview"
  process.env.CUSTOMER_DEV_OTP_CODE = CODE
  mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "approved" })
  )
  const result = await startCustomerPhoneVerification(PHONE)

  assert.deepEqual(result, { status: "unavailable" })
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test("Given Preview When the phone is explicitly approved Then Twilio remains available", async () => {
  configureProvider()
  process.env.VERCEL_ENV = "preview"
  allowPhone(PHONE)
  mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "pending" })
  )
  const result = await startCustomerPhoneVerification(PHONE)

  assert.deepEqual(result, { status: "sent" })
  assert.equal(globalThis.fetch.mock.callCount(), 1)
})

function configureProvider() {
  process.env.TWILIO_ACCOUNT_SID = "AC_test"
  process.env.TWILIO_AUTH_TOKEN = "test-token"
  process.env.TWILIO_VERIFY_SERVICE_SID = "VA_test"
  delete process.env.CUSTOMER_DEV_OTP_CODE
  delete process.env.CUSTOMER_OTP_BYPASS_MODE
}

function allowPhone(phone) {
  process.env.NON_PRODUCTION_DELIVERY_HMAC_SECRET = DELIVERY_SECRET
  const digest = deliveryDestinationFingerprint(
    { channel: "sms", destination: phone },
    DELIVERY_SECRET
  )
  process.env.NON_PRODUCTION_DELIVERY_ALLOWLIST = `sms:${digest}`
}
