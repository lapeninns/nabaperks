import assert from "node:assert/strict"
import { test } from "node:test"
import {
  sendEmailOtp,
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
