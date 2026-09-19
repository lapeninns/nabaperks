import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import {
  parseTwilioForm,
  verifyTwilioSignature,
  parseTwilioStatus,
} from "../../lib/notifications/twilio-signature-core.ts"

const url = "https://example.test/api/twilio/status?delivery_id=123"
const secret = "local-fixture-auth-token"
const body = `MessageSid=SM${"1".repeat(32)}&MessageStatus=delivered&FutureField=a%2Bb`
const params = new URLSearchParams(body)
const signature = createHmac("sha1", secret)
  .update(
    url +
      [...params]
        .sort(([a], [b]) => a.localeCompare(b))
        .flat()
        .join("")
  )
  .digest("base64")

test("verifies all evolving form parameters with exact query-bearing URL", () => {
  assert.equal(
    verifyTwilioSignature({
      authToken: secret,
      url,
      params: parseTwilioForm(body),
      signature,
    }),
    true
  )
})
test("rejects altered host, query, body, secret and malformed signatures", () => {
  const base = { authToken: secret, url, params, signature }
  for (const change of [
    { url: url.replace("example.test", "evil.test") },
    { url: url.split("?")[0] },
    { params: new URLSearchParams(body + "&Extra=1") },
    { authToken: "wrong" },
    { signature: "bad" },
    { signature: signature + "!" },
    { signature: "" },
  ])
    assert.equal(verifyTwilioSignature({ ...base, ...change }), false)
})
test("rejects duplicate fields and malformed percent encodings before ambiguous parsing", () => {
  for (const raw of [
    "MessageSid=a&MessageSid=b",
    "Body=%ZZ",
    "Body=%FF",
    "=value",
  ])
    assert.equal(parseTwilioForm(raw), null)
})
test("parses status with stable provider identity and ignores unrelated PII", () => {
  assert.deepEqual(parseTwilioStatus(params), {
    providerMessageSid: `SM${"1".repeat(32)}`,
    providerStatus: "delivered",
    providerErrorCode: null,
  })
  assert.equal(
    parseTwilioStatus(
      new URLSearchParams("MessageSid=bad&MessageStatus=delivered")
    ),
    null
  )
  assert.equal(
    parseTwilioStatus(
      new URLSearchParams(body.replace("delivered", "invented"))
    ),
    null
  )
})
