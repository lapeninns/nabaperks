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
