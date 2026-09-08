import assert from "node:assert/strict"
import { test } from "node:test"
import { inviteUnsubscribeHeaders } from "@/lib/notifications/invite-unsubscribe-headers"
import { buildTransactionalEmailPayload } from "@/lib/notifications/transactional-email-payload"

for (const kind of ["invite", "claim"]) {
  test(`${kind} email payload has both one-click headers with the unsubscribe token`, () => {
    const token = "opaque-unsubscribe-token"
    const headers = inviteUnsubscribeHeaders(
      "https://nabaperks.com/",
      kind,
      token
    )
    const payload = buildTransactionalEmailPayload(
      "Nabaperks <login@nabaperks.com>",
      {
        to: "delivered@resend.dev",
        subject: "Invite",
        text: "Invite",
        html: "<p>Invite</p>",
        replyTo: "support@nabaperks.com",
        headers,
      }
    )
    assert.equal(
      payload.headers["List-Unsubscribe"],
      `<https://nabaperks.com/api/email/unsubscribe/${kind}/${token}>, <mailto:unsubscribe@nabaperks.com?subject=${kind}-${token}>`
    )
    assert.equal(
      payload.headers["List-Unsubscribe-Post"],
      "List-Unsubscribe=One-Click"
    )
    assert.equal(payload.reply_to, "support@nabaperks.com")
  })
}
