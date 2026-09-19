import assert from "node:assert/strict"
import test from "node:test"
import {
  buildTwilioMessageParams,
  classifyTwilioSendFailure,
  parseContentSidMap,
  whatsappVariable,
} from "../../lib/notifications/twilio-messaging-core.ts"

const input = {
  channel: "whatsapp",
  recipient: "+447700900123",
  deliveryId: "00000000-0000-4000-8000-000000000001",
  body: "Reward ready",
  variables: { 1: "  The\n Venue\t " },
  messagingServiceSid: `MG${"1".repeat(32)}`,
  contentSid: `HX${"2".repeat(32)}`,
  statusCallbackUrl: "https://example.test/api/twilio/status",
}

test("builds approved WhatsApp content with delivery correlation", () => {
  const params = buildTwilioMessageParams(input)
  assert.equal(params.get("To"), "whatsapp:+447700900123")
  assert.equal(params.get("ContentSid"), input.contentSid)
  assert.equal(params.get("ContentVariables"), '{"1":"The Venue"}')
  assert.equal(params.has("Body"), false)
  assert.equal(
    new URL(params.get("StatusCallback")).searchParams.get("delivery_id"),
    input.deliveryId
  )
})
test("builds SMS without WhatsApp content fields", () => {
  const params = buildTwilioMessageParams({ ...input, channel: "sms" })
  assert.equal(params.get("To"), input.recipient)
  assert.equal(params.get("Body"), input.body)
  assert.equal(params.has("ContentSid"), false)
})
test("fails closed on missing content and invalid recipient", () => {
  assert.throws(() =>
    buildTwilioMessageParams({ ...input, contentSid: undefined })
  )
  assert.throws(() =>
    buildTwilioMessageParams({ ...input, recipient: "whatsapp:+447700900123" })
  )
})
test("parses content mapping and rejects malformed or non-SID entries", () => {
  assert.deepEqual(
    parseContentSidMap(JSON.stringify({ reward_unlocked: input.contentSid })),
    { reward_unlocked: input.contentSid }
  )
  for (const raw of [
    "{",
    "[]",
    '{"reward_unlocked":"bad"}',
    '{"__proto__":"bad"}',
  ])
    assert.throws(() => parseContentSidMap(raw))
})
test("sanitises template whitespace and bounds variables", () => {
  assert.equal(whatsappVariable(" A\r\n B\tC\u0000 "), "A B C")
  assert.equal(whatsappVariable("a".repeat(2000)).length, 1024)
})
test("only documented recipient or window failures allow WhatsApp fallback", () => {
  for (const code of [63003, 63024, 63016, 63049])
    assert.equal(
      classifyTwilioSendFailure({ status: 400, code }).fallbackAllowed,
      true
    )
  for (const code of [63040, 63027, 20003, 21610])
    assert.equal(
      classifyTwilioSendFailure({ status: 400, code }).fallbackAllowed,
      false
    )
  assert.equal(
    classifyTwilioSendFailure({ status: 429 }).reason,
    "rate_limited"
  )
  assert.equal(
    classifyTwilioSendFailure({ status: 503 }).reason,
    "provider_unavailable"
  )
})
