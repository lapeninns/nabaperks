import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { buildPosterPdfAttachments } from "@/lib/notifications/poster-pdf"
import { buildTransactionalEmailPayload } from "@/lib/notifications/transactional-email-payload"

test("transactional email payload forwards all five real poster PDFs to Resend", async () => {
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
  assert.equal(payload.attachments.length, 5)
  assert.ok(
    payload.attachments.every(({ content }) => content.startsWith("JVBERi0"))
  )
  assert.doesNotMatch(`${payload.text}${payload.html}`, /https?:\/\//)
})
