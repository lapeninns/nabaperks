import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"

const INPUT = {
  venueName: "Old Crown Girton",
}

test("buildPosterEmailContent describes attached PDFs without a poster link", () => {
  const { subject, text, html } = buildPosterEmailContent(INPUT)
  const count = String(QR_POSTER_PRODUCTION_TEMPLATES.length)

  assert.match(subject, /poster/i)
  for (const part of [text, html]) {
    assert.ok(part.includes("Old Crown Girton"), "venue name present")
    assert.match(part, new RegExp(count))
    assert.match(part, /attach/i)
    assert.doesNotMatch(part, /https?:\/\//)
    assert.match(part, new RegExp(`${count} A4.*counter`, "i"))
    assert.doesNotMatch(part, /B5|table-tent/i)
    assert.match(part, /210 × 297 mm/)
    assert.match(part, /physical print at actual size/i)
    assert.match(part, /representative phones/i)
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
