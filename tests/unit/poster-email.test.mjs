import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"

const INPUT = {
  venueName: "Old Crown Girton",
}

test("buildPosterEmailContent describes the print kit without a link", () => {
  const { subject, text, html } = buildPosterEmailContent(INPUT)
  const posterCount = String(QR_POSTER_PRODUCTION_TEMPLATES.length)
  const tentCount = String(TENT_PRODUCTION_DESIGNS.length)

  assert.match(subject, /print kit/i)
  for (const part of [text, html]) {
    assert.ok(part.includes("Old Crown Girton"), "venue name present")
    assert.match(part, /attach/i)
    assert.doesNotMatch(part, /https?:\/\//)
    // The kit names both counts: posters and table tents.
    assert.match(part, new RegExp(`${posterCount} A4.*counter posters`, "i"))
    assert.match(part, new RegExp(`${tentCount} A4.*table tents`, "i"))
    // The stale B5 format must never appear; A4 table tents may.
    assert.doesNotMatch(part, /b5/i)
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
