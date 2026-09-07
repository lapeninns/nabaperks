import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

const PHONE = "+447700900123"
const CODE = "424242"
const { checkCustomerPhoneVerification, startCustomerPhoneVerification } =
  await import("@/lib/customer/verification")

afterEach(() => {
  mock.restoreAll()
  delete process.env.VERCEL_ENV
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

test("Given a preview deployment When a dev OTP is configured Then provider bypass stays disabled", async () => {
  configureProvider()
  process.env.VERCEL_ENV = "preview"
  process.env.CUSTOMER_DEV_OTP_CODE = CODE
  mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "approved" })
  )
  const result = await startCustomerPhoneVerification(PHONE)

  assert.deepEqual(result, { status: "sent", channel: "sms" })
  assert.equal(globalThis.fetch.mock.callCount(), 1)
})

test("Given the provider refuses a WhatsApp send When the code is requested Then it goes out by text and says so", async () => {
  configureProvider()
  const channels = []
  mock.method(globalThis, "fetch", async (_url, init) => {
    channels.push(new URLSearchParams(init.body).get("Channel"))
    return channels.length === 1
      ? new Response('{"code":60220}', { status: 400 })
      : Response.json({ status: "pending" })
  })
  const result = await startCustomerPhoneVerification(PHONE, "whatsapp")

  assert.deepEqual(result, { status: "sent", channel: "sms" })
  assert.deepEqual(channels, ["whatsapp", "sms"])
})

test("Given the provider is down When a WhatsApp code is requested Then no second channel is tried", async () => {
  configureProvider()
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 503 })
  )
  const result = await startCustomerPhoneVerification(PHONE, "whatsapp")

  assert.deepEqual(result, { status: "unavailable" })
  assert.equal(globalThis.fetch.mock.callCount(), 1)
})

test("Given a WhatsApp send is accepted When the code is requested Then the result names WhatsApp for the code step", async () => {
  configureProvider()
  mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "pending" })
  )
  const result = await startCustomerPhoneVerification(PHONE, "whatsapp")

  assert.deepEqual(result, { status: "sent", channel: "whatsapp" })
  assert.equal(globalThis.fetch.mock.callCount(), 1)
})

function configureProvider() {
  process.env.TWILIO_ACCOUNT_SID = "AC_test"
  process.env.TWILIO_AUTH_TOKEN = "test-token"
  process.env.TWILIO_VERIFY_SERVICE_SID = "VA_test"
  delete process.env.CUSTOMER_DEV_OTP_CODE
  delete process.env.CUSTOMER_OTP_BYPASS_MODE
}
