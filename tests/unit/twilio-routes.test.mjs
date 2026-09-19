import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { registerHooks } from "node:module"
import test from "node:test"

const calls = []
globalThis.twilioFixtureRpc = async (name, args) => {
  calls.push({ name, args })
  return { data: true, error: null }
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase/server")
      return { url: "fixture:twilio-database", shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === "fixture:twilio-database")
      return {
        format: "module",
        source:
          "export function createSupabaseServiceRoleClient() { return { rpc: globalThis.twilioFixtureRpc } }",
        shortCircuit: true,
      }
    return nextLoad(url, context)
  },
})
const { POST: statusPost } =
  await import("../../app/api/twilio/status/route.ts")
const { POST: inboundPost } =
  await import("../../app/api/twilio/inbound/route.ts")
const secret = "fixture-auth-token"
const appUrl = "https://canonical.example.test"
function fixture(t) {
  calls.length = 0
  t.mock.property(process, "env", {
    ...process.env,
    NEXT_PUBLIC_APP_URL: appUrl,
    TWILIO_AUTH_TOKEN: secret,
    CUSTOMER_PHONE_HMAC_SECRET: "fixture-hmac",
  })
}
function request(path, fields) {
  const params = new URLSearchParams(fields)
  const signed =
    appUrl +
    path +
    [...params.keys()]
      .sort()
      .map((key) => key + params.get(key))
      .join("")
  return new Request("http://internal.example.test" + path, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": createHmac("sha1", secret)
        .update(signed)
        .digest("base64"),
    },
    body: params,
  })
}
test("status route sends stable provider SID to monotonic RPC on repeated callbacks", async (t) => {
  fixture(t)
  const fields = {
    MessageSid: `SM${"a".repeat(32)}`,
    MessageStatus: "delivered",
    To: "+447700900123",
  }
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await statusPost(
          request(
            "/api/twilio/status?delivery_id=00000000-0000-4000-8000-000000000001",
            fields
          )
        )
      ).status,
      200
    )
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.name, "apply_twilio_message_status")
    assert.equal(call.args.p_provider_message_sid, fields.MessageSid)
    assert.deepEqual(Object.keys(call.args).sort(), [
      "p_delivery_id",
      "p_provider_error_code",
      "p_provider_message_sid",
      "p_provider_status",
    ])
    assert.equal(
      call.args.p_delivery_id,
      "00000000-0000-4000-8000-000000000001"
    )
  }
})
test("inbound route persists only HMAC and keyword and avoids duplicate provider reply", async (t) => {
  fixture(t)
  const fields = {
    MessageSid: `SM${"b".repeat(32)}`,
    From: "whatsapp:+447700900123",
    Body: "STOP",
    OptOutType: "STOP",
  }
  const response = await inboundPost(request("/api/twilio/inbound", fields))
  assert.equal(response.status, 200)
  assert.equal(await response.text(), "<Response/>")
  assert.equal(calls[0].name, "enforce_rate_limit")
  assert.deepEqual(calls[1], {
    name: "record_customer_messaging_inbound",
    args: {
      p_provider_message_sid: fields.MessageSid,
      p_channel: "whatsapp",
      p_phone_hmac: createHmac("sha256", "fixture-hmac")
        .update("+447700900123")
        .digest("hex"),
      p_keyword: "stop",
    },
  })
  assert.equal(JSON.stringify(calls).includes("447700900123"), false)
})
test("invalid signatures cannot reach either route database boundary", async (t) => {
  fixture(t)
  for (const [path, post] of [
    ["/api/twilio/status", statusPost],
    ["/api/twilio/inbound", inboundPost],
  ]) {
    const req = request(path, { Body: "STOP" })
    req.headers.set("x-twilio-signature", "bad")
    assert.equal((await post(req)).status, 401)
  }
  assert.deepEqual(calls, [])
})
