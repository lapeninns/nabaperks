import assert from "node:assert/strict"
import test from "node:test"
import { buildPhoneMessageCopy } from "../../lib/notifications/catalog.ts"
import { sendCustomerMessage } from "../../lib/notifications/twilio-messaging.ts"

const input = {
  channel: "sms",
  recipient: "+447700900123",
  deliveryId: "fixture-delivery",
  eventType: "reward_unlocked",
  body: "Fixture only",
  variables: {},
}
function configuredEnv(t) {
  t.mock.property(process, "env", {
    ...process.env,
    CUSTOMER_MESSAGING_MODE: "live",
    CUSTOMER_MESSAGING_BYPASS_MODE: "",
    CI: "",
    VERCEL: "",
    VERCEL_ENV: "",
    TWILIO_ACCOUNT_SID: `AC${"1".repeat(32)}`,
    TWILIO_API_KEY_SID: `SK${"2".repeat(32)}`,
    TWILIO_API_KEY_SECRET: "local-fixture",
    TWILIO_CUSTOMER_MESSAGING_SERVICE_SID: `MG${"3".repeat(32)}`,
    NEXT_PUBLIC_APP_URL: "https://example.test",
    TWILIO_CONTENT_SIDS: "{}",
  })
}
test("off mode never makes a provider attempt", async (t) => {
  t.mock.property(process, "env", {
    ...process.env,
    CUSTOMER_MESSAGING_MODE: "off",
  })
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected send")
  })
  assert.deepEqual(await sendCustomerMessage(input), {
    status: "skipped",
    reason: "channel_disabled",
  })
})
test("dry run never sends and hosted bypass fails closed", async (t) => {
  configuredEnv(t)
  const send = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected send")
  })
  process.env.CUSTOMER_MESSAGING_MODE = "dry_run"
  assert.deepEqual(await sendCustomerMessage(input), {
    status: "skipped",
    reason: "channel_disabled",
  })
  process.env.CUSTOMER_MESSAGING_MODE = "live"
  process.env.CUSTOMER_MESSAGING_BYPASS_MODE = "log"
  process.env.VERCEL = "1"
  await assert.rejects(sendCustomerMessage(input), {
    name: "TwilioMessageConfigurationError",
  })
  assert.equal(send.mock.callCount(), 0)
})
test("accepts only a valid provider message identity", async (t) => {
  configuredEnv(t)
  let attempts = 0
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(
      init.headers.Authorization,
      `Basic ${Buffer.from(`SK${"2".repeat(32)}:local-fixture`).toString("base64")}`
    )
    assert.equal(init.signal instanceof AbortSignal, true)
    assert.equal(new URLSearchParams(init.body).get("Body"), input.body)
    return Response.json(
      { sid: `SM${"4".repeat(32)}`, status: "queued" },
      { status: 201 }
    )
  })
  assert.deepEqual(
    await sendCustomerMessage({
      ...input,
      beforeProviderAttempt: async () => {
        attempts += 1
      },
    }),
    {
      status: "accepted",
      providerMessageSid: `SM${"4".repeat(32)}`,
      providerStatus: "queued",
    }
  )
  assert.equal(attempts, 1)
})
test("auth token satisfies transport configuration without an API key pair", async (t) => {
  configuredEnv(t)
  delete process.env.TWILIO_API_KEY_SID
  delete process.env.TWILIO_API_KEY_SECRET
  process.env.TWILIO_AUTH_TOKEN = "fixture-auth-token"
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(
      init.headers.Authorization,
      `Basic ${Buffer.from(`AC${"1".repeat(32)}:fixture-auth-token`).toString("base64")}`
    )
    return Response.json(
      { sid: `SM${"4".repeat(32)}`, status: "queued" },
      { status: 201 }
    )
  })
  assert.equal((await sendCustomerMessage(input)).status, "accepted")
})
test("actual send params preserve service and marketing catalogue copy without logging contents", async (t) => {
  configuredEnv(t)
  const logs = t.mock.method(console, "info", () => {})
  const bodies = []
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    bodies.push(new URLSearchParams(init.body))
    return Response.json(
      { sid: `SM${"4".repeat(32)}`, status: "queued" },
      { status: 201 }
    )
  })
  const service = buildPhoneMessageCopy({
    eventType: "reward_ready",
    businessName: "The Example Inn",
    rewardName: "House reward",
    url: "/home/rewards",
  })
  const marketing = buildPhoneMessageCopy({
    eventType: "venue_announcement",
    businessName: "The Example Inn",
    announcementTitle: "Tonight at the venue",
    announcementBody: "Kitchen service runs until 9pm.",
    url: "/home",
  })
  const marketingContentSid = `HX${"5".repeat(32)}`
  process.env.TWILIO_CONTENT_SIDS = JSON.stringify({
    venue_announcement: marketingContentSid,
  })
  for (const [eventType, copy] of [
    ["reward_ready", service],
    ["venue_announcement", marketing],
  ]) {
    assert.equal(
      (
        await sendCustomerMessage({
          ...input,
          eventType,
          body: copy.smsBody,
          variables: copy.whatsappVariables,
        })
      ).status,
      "accepted"
    )
  }
  assert.equal(
    (
      await sendCustomerMessage({
        ...input,
        channel: "whatsapp",
        eventType: "venue_announcement",
        body: marketing.smsBody,
        variables: marketing.whatsappVariables,
      })
    ).status,
    "accepted"
  )
  assert.equal(bodies[0].get("Body"), service.smsBody)
  assert.doesNotMatch(bodies[0].get("Body"), /Reply STOP/)
  assert.equal(bodies[1].get("Body"), marketing.smsBody)
  assert.match(bodies[1].get("Body"), /Reply STOP to opt out\.$/)
  assert.equal(bodies[2].has("Body"), false)
  assert.equal(bodies[2].get("ContentSid"), marketingContentSid)
  assert.deepEqual(
    JSON.parse(bodies[2].get("ContentVariables")),
    marketing.whatsappVariables
  )
  assert.equal(logs.mock.callCount(), 0)
})
test("reward-collected copy reaches exact SMS and WhatsApp provider params", async (t) => {
  configuredEnv(t)
  const bodies = []
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    bodies.push(new URLSearchParams(init.body))
    return Response.json(
      { sid: `SM${"4".repeat(32)}`, status: "queued" },
      { status: 201 }
    )
  })
  const copy = buildPhoneMessageCopy({
    eventType: "reward_collected_cycle_started",
    businessName: "The Example Inn",
    rewardName: "Free starter",
    url: "/card/membership-123",
  })
  const contentSid = `HX${"6".repeat(32)}`
  process.env.TWILIO_CONTENT_SIDS = JSON.stringify({
    reward_collected_cycle_started: contentSid,
  })

  for (const channel of ["sms", "whatsapp"]) {
    assert.equal(
      (
        await sendCustomerMessage({
          ...input,
          channel,
          eventType: "reward_collected_cycle_started",
          body: copy.smsBody,
          variables: copy.whatsappVariables,
        })
      ).status,
      "accepted"
    )
  }

  assert.equal(
    bodies[0].get("Body"),
    "Free starter collected at The Example Inn."
  )
  assert.equal(bodies[1].has("Body"), false)
  assert.equal(bodies[1].get("ContentSid"), contentSid)
  assert.deepEqual(JSON.parse(bodies[1].get("ContentVariables")), {
    1: "Reward collected",
    2: "Free starter collected at The Example Inn.",
    3: "/card/membership-123",
  })
})

test("local bypass logs correlation only and excludes recipient and content", async (t) => {
  configuredEnv(t)
  process.env.CUSTOMER_MESSAGING_BYPASS_MODE = "log"
  const lines = []
  t.mock.method(console, "info", (line) => lines.push(line))
  assert.deepEqual(await sendCustomerMessage(input), {
    status: "skipped",
    reason: "local_bypass",
  })
  assert.equal(lines.length, 1)
  assert.match(lines[0], /customer_message_local_bypass/)
  assert.match(lines[0], /fixture-delivery/)
  assert.doesNotMatch(lines[0], /447700900123|Fixture only/)
})
test("network uncertainty is ambiguous and never retried", async (t) => {
  configuredEnv(t)
  const send = t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fixture disconnect")
  })
  assert.deepEqual(await sendCustomerMessage(input), {
    status: "ambiguous",
    reason: "transport_uncertain",
  })
  assert.equal(send.mock.callCount(), 1)
})
test("malformed success remains ambiguous without exposing response PII", async (t) => {
  configuredEnv(t)
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: input.recipient })
  )
  assert.deepEqual(await sendCustomerMessage(input), {
    status: "ambiguous",
    reason: "invalid_provider_response",
  })
})
test("provider rejection captures numeric code without body or recipient", async (t) => {
  configuredEnv(t)
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ code: 21610, message: input.recipient }, { status: 400 })
  )
  assert.deepEqual(await sendCustomerMessage(input), {
    status: "rejected",
    reason: "provider_rejected",
    errorCode: "21610",
    fallbackAllowed: false,
  })
})
