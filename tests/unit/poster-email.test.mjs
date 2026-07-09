import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPosterEmailContent } from "@/lib/notifications/poster-email"

const INPUT = {
  venueName: "Old Crown Girton",
  posterUrl: "https://nabaperks.com/app/qr",
  shareUrl: "https://nabaperks.com/q/abc123",
}

test("buildPosterEmailContent includes both links and a poster subject", () => {
  const { subject, text, html } = buildPosterEmailContent(INPUT)

  assert.match(subject, /poster/i)
  // Both actionable links appear in the plain-text and HTML parts.
  for (const part of [text, html]) {
    assert.ok(part.includes(INPUT.posterUrl), "poster URL present")
    assert.ok(part.includes(INPUT.shareUrl), "share URL present")
    assert.ok(part.includes("Old Crown Girton"), "venue name present")
  }
})

test("buildPosterEmailContent HTML-escapes the merchant-controlled venue name", () => {
  const { html, text } = buildPosterEmailContent({
    ...INPUT,
    venueName: 'Bob & "Sons" <Bar>',
  })

  // Raw angle brackets / ampersand must not reach the HTML unescaped.
  assert.ok(!html.includes("<Bar>"), "no unescaped tag injection")
  assert.ok(html.includes("&lt;Bar&gt;"), "brackets escaped")
  assert.ok(html.includes("Bob &amp;"), "ampersand escaped")
  // Plain-text part keeps the literal name.
  assert.ok(text.includes('Bob & "Sons" <Bar>'))
})
