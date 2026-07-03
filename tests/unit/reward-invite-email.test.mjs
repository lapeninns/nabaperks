import assert from "node:assert/strict"
import { test } from "node:test"

import { buildRewardInviteEmail } from "@/lib/notifications/reward-invite-email"

/**
 * MS-rewards-merchant-sent (Phase 4) — the invite email builder. PECR posture:
 * the reason line + unsubscribe link are always present, and merchant-supplied
 * copy is HTML-escaped.
 */

const BASE = {
  businessName: "Old Crown",
  rewardName: "A free drink",
  claimUrl: "https://nabaperks.com/claim/abc",
  unsubscribeUrl: "https://nabaperks.com/claim/abc?unsubscribe=1",
}

test("subject + claim + unsubscribe + reason are present", () => {
  const email = buildRewardInviteEmail(BASE)
  assert.match(email.subject, /A reward is waiting for you at Old Crown/)
  assert.match(email.text, /Claim it: https:\/\/nabaperks\.com\/claim\/abc/)
  assert.match(email.text, /Unsubscribe: /)
  assert.match(email.text, /one-off email/)
  assert.match(email.html, /Claim your reward/)
  assert.match(email.html, /unsubscribe=1/)
})

test("merchant-supplied copy is HTML-escaped", () => {
  const email = buildRewardInviteEmail({
    ...BASE,
    businessName: "Bar <script>",
    personalMessage: "Cheers & thanks <b>friend</b>",
  })
  assert.ok(!email.html.includes("<script>"), "no raw script tag")
  assert.match(email.html, /Bar &lt;script&gt;/)
  assert.match(email.html, /Cheers &amp; thanks &lt;b&gt;friend&lt;\/b&gt;/)
})
