import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { buildPosterPdfAttachments } from "@/lib/notifications/poster-pdf"
import { buildTransactionalEmailPayload } from "@/lib/notifications/transactional-email-payload"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"

test("transactional email payload forwards all production poster PDFs to Resend", async () => {
  // Given the complete attachment bundle produced for a merchant QR.
  const attachments = await buildPosterPdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 5,
  })
  const content = buildPosterEmailContent({ venueName: "Old Crown Girton" })

  // When the provider payload is built.
  const payload = buildTransactionalEmailPayload(
    "Nabaperks <hello@example.com>",
    {
      to: "merchant@example.com",
      ...content,
      attachments,
    }
  )

  // Then the provider receives the complete attachment array without mutation.
  assert.deepEqual(payload.attachments, attachments)
  assert.deepEqual(payload.to, ["merchant@example.com"])
  assert.equal(
    payload.attachments.length,
    QR_POSTER_PRODUCTION_TEMPLATES.length
  )
  assert.ok(
    payload.attachments.every(({ content }) => content.startsWith("JVBERi0"))
  )
  assert.doesNotMatch(`${payload.text}${payload.html}`, /https?:\/\//)
})

test("optional email metadata is omitted when unset and passed in provider format when set", () => {
  const email = {
    to: "delivered@resend.dev",
    subject: "Fixture",
    text: "Fixture",
    html: "<p>Fixture</p>",
  }
  const from = "Nabaperks <login@nabaperks.com>"
  assert.deepEqual(buildTransactionalEmailPayload(from, email), {
    from,
    to: [email.to],
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
  const headers = {
    "List-Unsubscribe": "<https://nabaperks.com/example>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
  const payload = buildTransactionalEmailPayload(from, {
    ...email,
    replyTo: "Nabaperks <support@nabaperks.com>",
    headers,
  })
  assert.equal(payload.reply_to, "Nabaperks <support@nabaperks.com>")
  assert.deepEqual(payload.headers, headers)
})
