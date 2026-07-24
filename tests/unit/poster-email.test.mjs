import assert from "node:assert/strict"
import { test } from "node:test"

import { buildPosterEmailContent } from "@/lib/notifications/poster-email"
import { NFC_CARD_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-card-templates"
import { NFC_SQUARE_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-square-templates"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"

const INPUT = {
  venueName: "Old Crown Girton",
}

test("buildPosterEmailContent describes the print kit without a link", () => {
  const { subject, text, html } = buildPosterEmailContent(INPUT)
  const posterCount = String(QR_POSTER_PRODUCTION_TEMPLATES.length)
  const tentCount = String(TENT_PRODUCTION_DESIGNS.length)
  const nfcCount = String(NFC_CARD_PRODUCTION_DESIGNS.length)
  const nfcSquareCount = String(NFC_SQUARE_PRODUCTION_DESIGNS.length)

  assert.match(subject, /print kit/i)
  for (const part of [text, html]) {
    assert.ok(part.includes("Old Crown Girton"), "venue name present")
    assert.match(part, /attach/i)
    assert.doesNotMatch(part, /https?:\/\//)
    assert.match(part, new RegExp(`${posterCount} posters?`, "i"))
    assert.match(part, new RegExp(`${tentCount} table tents?`, "i"))
    assert.match(part, new RegExp(`${nfcCount} tap cards?`, "i"))
    assert.match(part, new RegExp(`${nfcSquareCount} wall tap plates?`, "i"))
    assert.doesNotMatch(part, /b5/i)
    assert.doesNotMatch(part, /fold-to-peak/i)
    assert.doesNotMatch(part, /\bCR80\b/)
    assert.match(part, /actual size/i)
    assert.match(part, /few phones/i)
    assert.match(part, /\?src=nfc/)
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
