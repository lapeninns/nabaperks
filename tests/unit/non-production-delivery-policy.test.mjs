import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

const SECRET = "N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?x"
const EMAIL = "owner@example.test"
const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/preview-token"

const { assertDeliveryDestinationAllowed, deliveryDestinationFingerprint } =
  await import("@/lib/notifications/non-production-delivery-policy")
const { sendTransactionalEmail } = await import("@/lib/notifications/resend")

afterEach(() => {
  mock.restoreAll()
  for (const name of [
    "NON_PRODUCTION_DELIVERY_ALLOWLIST",
    "NON_PRODUCTION_DELIVERY_HMAC_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM",
    "VERCEL_ENV",
    "VERCEL_TARGET_ENV",
  ]) {
    delete process.env[name]
  }
})

test("generic Preview disables delivery when no allowlist is configured", () => {
  process.env.VERCEL_ENV = "preview"

  assert.throws(
    () =>
      assertDeliveryDestinationAllowed({
        channel: "email",
        destination: EMAIL,
      }),
    { name: "NonProductionDeliveryBlockedError" }
  )
})

test("custom Staging disables delivery when no allowlist is configured", () => {
  process.env.VERCEL_TARGET_ENV = "staging"

  assert.throws(
    () =>
      assertDeliveryDestinationAllowed({
        channel: "sms",
        destination: "+447700900123",
      }),
    { name: "NonProductionDeliveryBlockedError" }
  )
})

test("Preview cannot bypass the gate by claiming a Production target", () => {
  process.env.VERCEL_ENV = "preview"
  process.env.VERCEL_TARGET_ENV = "production"

  assert.throws(
    () =>
      assertDeliveryDestinationAllowed({
        channel: "email",
        destination: EMAIL,
      }),
    { name: "NonProductionDeliveryBlockedError" }
  )
})

test("Preview permits only an exact channel-bound HMAC fingerprint", () => {
  process.env.VERCEL_ENV = "preview"
  allowDestination("email", EMAIL)

  assert.doesNotThrow(() =>
    assertDeliveryDestinationAllowed({
      channel: "email",
      destination: EMAIL.toUpperCase(),
    })
  )
  assert.throws(
    () =>
      assertDeliveryDestinationAllowed({
        channel: "sms",
        destination: EMAIL,
      }),
    { name: "NonProductionDeliveryBlockedError" }
  )
})

test("Production delivery behaviour is unchanged without non-production policy", () => {
  process.env.VERCEL_ENV = "production"

  assert.doesNotThrow(() =>
    assertDeliveryDestinationAllowed({
      channel: "email",
      destination: EMAIL,
    })
  )
})

test("Resend rejects an unapproved Preview recipient before provider I/O", async () => {
  process.env.VERCEL_ENV = "preview"
  configureResend()
  mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 202 })
  )

  await assert.rejects(
    sendTransactionalEmail({
      to: EMAIL,
      subject: "Preview",
      text: "Preview",
      html: "<p>Preview</p>",
    }),
    { name: "NonProductionDeliveryBlockedError" }
  )
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test("Resend preserves an explicitly approved Preview recipient", async () => {
  process.env.VERCEL_ENV = "preview"
  configureResend()
  allowDestination("email", EMAIL)
  mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 202 })
  )

  await sendTransactionalEmail({
    to: EMAIL,
    subject: "Preview",
    text: "Preview",
    html: "<p>Preview</p>",
  })

  assert.equal(globalThis.fetch.mock.callCount(), 1)
})

test("Web Push endpoints use exact channel-bound fingerprints", () => {
  process.env.VERCEL_ENV = "preview"
  allowDestination("web-push", PUSH_ENDPOINT)

  assert.doesNotThrow(() =>
    assertDeliveryDestinationAllowed({
      channel: "web-push",
      destination: PUSH_ENDPOINT,
    })
  )
  assert.throws(
    () =>
      assertDeliveryDestinationAllowed({
        channel: "web-push",
        destination: `${PUSH_ENDPOINT}-other`,
      }),
    { name: "NonProductionDeliveryBlockedError" }
  )
})

function allowDestination(channel, destination) {
  process.env.NON_PRODUCTION_DELIVERY_HMAC_SECRET = SECRET
  const digest = deliveryDestinationFingerprint(
    { channel, destination },
    SECRET
  )
  process.env.NON_PRODUCTION_DELIVERY_ALLOWLIST = `${channel}:${digest}`
}

function configureResend() {
  process.env.RESEND_API_KEY = "re_test"
  process.env.RESEND_FROM = "Nabaperks <preview@example.test>"
}
