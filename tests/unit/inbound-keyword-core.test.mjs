import assert from "node:assert/strict"
import test from "node:test"
import {
  parseInboundKeyword,
  parseTwilioInbound,
  inboundTwiml,
} from "../../lib/notifications/inbound-keyword-core.ts"

test("recognises exact opt-out keywords without treating prose as consent", () => {
  for (const word of [
    "STOP",
    " stop ",
    "UNSUBSCRIBE",
    "cancel",
    "END",
    "QUIT",
    "STOPALL",
    "REVOKE",
    "OPTOUT",
  ])
    assert.equal(parseInboundKeyword(word), "stop")
  assert.equal(parseInboundKeyword("START"), "start")
  assert.equal(parseInboundKeyword("HELP"), "help")
  assert.equal(parseInboundKeyword("please start marketing"), "other")
})
test("normalises sender and honours Advanced Opt-Out classification", () => {
  const form = new URLSearchParams({
    MessageSid: `SM${"a".repeat(32)}`,
    From: "whatsapp:+447700900123",
    Body: "localized text",
    OptOutType: "STOP",
  })
  assert.deepEqual(parseTwilioInbound(form), {
    providerMessageSid: `SM${"a".repeat(32)}`,
    channel: "whatsapp",
    sender: "+447700900123",
    keyword: "stop",
    providerReplied: true,
  })
})
test("rejects malformed senders and identities", () => {
  for (const sender of [
    "447700900123",
    "whatsapp:bad",
    "email:test@example.test",
  ])
    assert.equal(
      parseTwilioInbound(
        new URLSearchParams({
          MessageSid: `SM${"a".repeat(32)}`,
          From: sender,
          Body: "STOP",
        })
      ),
      null
    )
})
test("does not double-reply when Twilio Advanced Opt-Out already replied", () => {
  assert.equal(
    inboundTwiml({ keyword: "stop", providerReplied: true }),
    "<Response/>"
  )
  assert.match(
    inboundTwiml({ keyword: "stop", providerReplied: false }),
    /<Message>/
  )
  assert.equal(
    inboundTwiml({ keyword: "other", providerReplied: false }),
    "<Response/>"
  )
})
