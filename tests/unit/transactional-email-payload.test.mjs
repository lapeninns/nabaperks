import assert from "node:assert/strict"
import { test } from "node:test"

import { buildTransactionalEmailPayload } from "@/lib/notifications/transactional-email-payload"

test("transactional email payload forwards every Base64 attachment to Resend", () => {
  // Given a transactional email with two generated PDF files.
  const attachments = [
    { filename: "nabaperks-poster-editorial.pdf", content: "JVBERi0x" },
    { filename: "nabaperks-poster-bold.pdf", content: "JVBERi0y" },
  ]

  // When the provider payload is built.
  const payload = buildTransactionalEmailPayload(
    "Nabaperks <hello@example.com>",
    {
      to: "merchant@example.com",
      subject: "Your posters",
      text: "Attached.",
      html: "<p>Attached.</p>",
      attachments,
    }
  )

  // Then the provider receives the complete attachment array without mutation.
  assert.deepEqual(payload.attachments, attachments)
  assert.deepEqual(payload.to, ["merchant@example.com"])
})
