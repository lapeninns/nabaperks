import assert from "node:assert/strict"
import { test } from "node:test"
import {
  sendEmailOtp,
  prepareTransactionalEmailPayload,
  sendPreparedTransactionalEmail,
  sendTransactionalEmail,
} from "@/lib/notifications/resend"

test("the real Resend sender applies Reply-To to OTP and invite mail but only invites unsubscribe", async (t) => {
  const previous = { ...process.env }
  const calls = []
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls.push(JSON.parse(init.body))
    return new Response('{"id":"fixture"}', { status: 200 })
  })
  try {
    process.env.RESEND_API_KEY = "fixture-only"
    process.env.RESEND_FROM = "Nabaperks <login@nabaperks.com>"
    process.env.RESEND_REPLY_TO = " Nabaperks <support@nabaperks.com> "
    await sendEmailOtp({ to: "delivered@resend.dev", code: "123456" })
    assert.equal(calls[0].from, "Nabaperks <login@nabaperks.com>")
    assert.equal(calls[0].reply_to, "Nabaperks <support@nabaperks.com>")
    assert.equal(calls[0].headers, undefined)
    const headers = {
      "List-Unsubscribe":
        "<https://nabaperks.com/api/email/unsubscribe/invite/fixture>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
    await sendTransactionalEmail({
      to: "delivered@resend.dev",
      subject: "Invite",
      text: "Invite",
      html: "<p>Invite</p>",
      headers,
    })
    assert.deepEqual(calls[1].headers, headers)
    assert.equal(calls[1].reply_to, "Nabaperks <support@nabaperks.com>")
    delete process.env.RESEND_REPLY_TO
    await sendEmailOtp({ to: "delivered@resend.dev", code: "654321" })
    assert.equal(calls[2].reply_to, undefined)
  } finally {
    for (const key of ["RESEND_API_KEY", "RESEND_FROM", "RESEND_REPLY_TO"]) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

for (const marketingFrom of [undefined, "Nabaperks <hello@nabaperks.com>"]) {
  test(`Resend reuses the accepted legacy body and key (marketing sender ${marketingFrom})`, async (t) => {
    const keys = [
      "RESEND_API_KEY",
      "RESEND_FROM",
      "RESEND_REPLY_TO",
      "RESEND_MARKETING_FROM",
    ]
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]])
    )
    const legacy = {
      from: "Nabaperks <login@nabaperks.com>",
      to: ["delivered@resend.dev"],
      subject: "Invite",
      text: "Invite",
      html: "<p>Invite</p>",
    }
    const calls = []
    t.mock.method(globalThis, "fetch", async (_url, init) => {
      calls.push({
        body: JSON.parse(init.body),
        key: init.headers["Idempotency-Key"],
      })
      return init.body === JSON.stringify(legacy)
        ? Response.json({ id: "already-accepted" })
        : Response.json({ name: "invalid_idempotent_request" }, { status: 409 })
    })
    try {
      process.env.RESEND_API_KEY = "fixture-only"
      process.env.RESEND_FROM = legacy.from
      process.env.RESEND_REPLY_TO = "support@nabaperks.com"
      if (marketingFrom) process.env.RESEND_MARKETING_FROM = marketingFrom
      else delete process.env.RESEND_MARKETING_FROM
      await sendTransactionalEmail({
        to: legacy.to[0],
        subject: legacy.subject,
        text: legacy.text,
        html: legacy.html,
        category: "marketing",
        headers: { "List-Unsubscribe": "<https://nabaperks.com/unsubscribe>" },
        idempotencyKey: "pre-deployment-key",
      })
      assert.equal(calls.length, 2)
      assert.ok(calls[0].body.headers)
      assert.equal(calls[0].body.reply_to, "support@nabaperks.com")
      assert.deepEqual(calls[1].body, legacy)
      assert.deepEqual(
        calls.map((call) => call.key),
        ["pre-deployment-key", "pre-deployment-key"]
      )
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })
}

test("persisted operational mail sends identical bytes after sender settings change", async (t) => {
  const keys = ["RESEND_API_KEY", "RESEND_FROM", "RESEND_REPLY_TO"]
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  )
  const calls = []
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls.push({ body: init.body, key: init.headers["Idempotency-Key"] })
    return Response.json({ id: "accepted" })
  })
  try {
    process.env.RESEND_API_KEY = "fixture-only"
    process.env.RESEND_FROM = "original@example.test"
    process.env.RESEND_REPLY_TO = "original-reply@example.test"
    const payload = prepareTransactionalEmailPayload({
      to: "recipient@example.test",
      subject: "Original",
      text: "Original https://original.test/app/qr",
      html: "<p>Original</p>",
    })
    await sendPreparedTransactionalEmail({
      payload,
      idempotencyKey: "qr-status:fixture",
    })
    process.env.RESEND_FROM = "replacement@example.test"
    process.env.RESEND_REPLY_TO = "replacement-reply@example.test"
    await sendPreparedTransactionalEmail({
      payload,
      idempotencyKey: "qr-status:fixture",
    })
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[1], calls[0])
    assert.equal(calls[1].body, payload)
    assert.match(payload, /original-reply@example.test/)
    assert.doesNotMatch(payload, /replacement/)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})
