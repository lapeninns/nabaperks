import assert from "node:assert/strict"
import { test } from "node:test"

import { buildLoyaltyInviteEmail } from "@/lib/notifications/loyalty-invite-email"

/** Fixed British-English invitation copy: venue, two stamps, expiry, links. */

const BASE = {
  businessName: "Old Crown",
  claimUrl: "https://nabaperks.com/invite/abc",
  unsubscribeUrl: "https://nabaperks.com/invite/abc?unsubscribe=1",
  privacyUrl: "https://nabaperks.com/privacy",
  expiryDays: 30,
}

test("subject names the venue and the two-stamp offer", () => {
  const email = buildLoyaltyInviteEmail(BASE)
  assert.match(email.subject, /Two welcome stamps are waiting at Old Crown/)
})

test("body carries venue, offer, expiry, claim, privacy and unsubscribe", () => {
  const email = buildLoyaltyInviteEmail(BASE)
  assert.match(email.text, /Old Crown/)
  assert.match(email.text, /two welcome stamps/i)
  assert.match(email.text, /expires in 30 days/)
  assert.match(email.text, /https:\/\/nabaperks\.com\/invite\/abc/)
  assert.match(email.text, /Privacy notice: https:\/\/nabaperks\.com\/privacy/)
  assert.match(email.text, /Unsubscribe from Old Crown: /)
  assert.match(email.html, /Collect your two stamps/)
  assert.match(email.html, /unsubscribe=1/)
})

test("defaults a nonsensical expiry to 30 days", () => {
  const email = buildLoyaltyInviteEmail({ ...BASE, expiryDays: 0 })
  assert.match(email.text, /expires in 30 days/)
})

test("escapes a venue name so it can't inject markup", () => {
  const email = buildLoyaltyInviteEmail({
    ...BASE,
    businessName: "Bar <script>",
  })
  assert.ok(!email.html.includes("<script>"))
  assert.match(email.html, /Bar &lt;script&gt;/)
})
