import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { createServer } from "node:http"
import { once } from "node:events"
import test from "node:test"
import { readTwilioWebhook } from "../../lib/notifications/twilio-signature-core.ts"

test("local signed HTTP fixtures preserve exact URL and bound malformed bodies", async (t) => {
  const config = {
    authToken: "fixture-only-token",
    appUrl: "https://public.example.test",
    path: "/api/twilio/status",
  }
  const server = createServer(async (req, res) => {
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: "POST",
      headers: req.headers,
      body: req,
      duplex: "half",
    })
    const result = await readTwilioWebhook(request, config)
    res.writeHead(result.status, { "Content-Type": "application/json" })
    res.end(JSON.stringify("params" in result ? { accepted: true } : result))
  }).listen(0, "127.0.0.1")
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}/api/twilio/status?delivery_id=fixture`
  const form = new URLSearchParams({
    MessageSid: `SM${"1".repeat(32)}`,
    MessageStatus: "delivered",
    NewProviderField: "a+b",
  })
  const signedUrl = `${config.appUrl}${config.path}?delivery_id=fixture`
  const signature = createHmac("sha1", config.authToken)
    .update(
      signedUrl +
        [...form.keys()]
          .sort()
          .map((key) => key + form.get(key))
          .join("")
    )
    .digest("base64")
  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    "x-twilio-signature": signature,
    "x-forwarded-host": "attacker.test",
  }
  assert.equal(
    (await fetch(base, { method: "POST", headers, body: form })).status,
    200
  )
  assert.equal(
    (
      await fetch(base, {
        method: "POST",
        headers: { ...headers, "x-twilio-signature": "bad" },
        body: form,
      })
    ).status,
    401
  )
  assert.equal(
    (await fetch(base, { method: "POST", headers, body: "Body=%ZZ" })).status,
    400
  )
  assert.equal(
    (
      await fetch(base, {
        method: "POST",
        headers,
        body: "a=" + "x".repeat(1_048_576),
      })
    ).status,
    413
  )
  assert.equal(
    (
      await fetch(base, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: "{}",
      })
    ).status,
    415
  )
})
