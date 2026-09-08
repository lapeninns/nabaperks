import assert from "node:assert/strict"
import { test } from "node:test"
import {
  sendEmailOtp,
  sendTransactionalEmail,
} from "@/lib/notifications/resend"

test("marketing configuration separates invitations from OTP and falls back when unset", async (t) => {
  const keys = [
    "RESEND_API_KEY",
    "RESEND_FROM",
    "RESEND_REPLY_TO",
    "RESEND_MARKETING_FROM",
  ]
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  const payloads = []
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payloads.push(JSON.parse(init.body))
    return new Response("{}", { status: 200 })
  })
  const input = {
    to: "delivered@resend.dev",
    subject: "Fixture",
    text: "Fixture",
    html: "<p>Fixture</p>",
    category: "marketing",
  }
  try {
    process.env.RESEND_API_KEY = "fixture-only"
    process.env.RESEND_FROM = "Nabaperks <login@nabaperks.com>"
    process.env.RESEND_MARKETING_FROM = " Nabaperks <hello@mail.nabaperks.com> "
    process.env.RESEND_REPLY_TO = "support@nabaperks.com"
    await sendTransactionalEmail(input)
    await sendEmailOtp({ to: input.to, code: "123456" })
    assert.equal(payloads[0].from, "Nabaperks <hello@mail.nabaperks.com>")
    assert.equal(payloads[0].reply_to, "support@nabaperks.com")
    assert.equal(payloads[0].category, undefined)
    assert.equal(payloads[1].from, "Nabaperks <login@nabaperks.com>")
    assert.equal(payloads[1].headers, undefined)
    for (const configured of [undefined, "   "]) {
      if (configured === undefined) delete process.env.RESEND_MARKETING_FROM
      else process.env.RESEND_MARKETING_FROM = configured
      await sendTransactionalEmail(input)
      assert.equal(payloads.at(-1).from, "Nabaperks <login@nabaperks.com>")
    }
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test("sender cutover replays the legacy payload with the same key without another delivery", async (t) => {
  const keys = [
    "RESEND_API_KEY",
    "RESEND_FROM",
    "RESEND_MARKETING_FROM",
    "RESEND_REPLY_TO",
  ]
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  )
  const accepted = new Map()
  const attempts = []
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const key = new Headers(init.headers).get("Idempotency-Key")
    const body = JSON.parse(init.body)
    attempts.push({ key, body })
    if (accepted.has(key) && accepted.get(key) !== init.body) {
      return Response.json(
        { name: "invalid_idempotent_request" },
        { status: 409 }
      )
    }
    accepted.set(key, init.body)
    return Response.json({ id: "same-provider-message" })
  })
  const input = {
    to: "person@example.test",
    subject: "Digest",
    text: "Weekly report",
    html: "<p>Weekly report</p>",
    category: "marketing",
    idempotencyKey: "merchant-digest:fixture:2026-09-07",
  }
  try {
    process.env.RESEND_API_KEY = "fixture-only"
    process.env.RESEND_FROM = "Nabaperks <login@nabaperks.com>"
    delete process.env.RESEND_MARKETING_FROM
    delete process.env.RESEND_REPLY_TO
    await sendTransactionalEmail(input)
    process.env.RESEND_MARKETING_FROM = "Nabaperks <hello@mail.nabaperks.com>"
    await sendTransactionalEmail(input)
    assert.equal(accepted.size, 1)
    assert.equal(attempts.length, 3)
    assert.deepEqual(attempts[0], attempts[2])
    assert.equal(attempts[1].key, attempts[0].key)
    assert.notEqual(attempts[1].body.from, attempts[0].body.from)
    const next = { ...input, idempotencyKey: "merchant-digest:new:2026-09-07" }
    await sendTransactionalEmail(next)
    await sendTransactionalEmail(next)
    assert.equal(accepted.size, 2)
    assert.equal(attempts.at(-1).body.from, process.env.RESEND_MARKETING_FROM)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})
