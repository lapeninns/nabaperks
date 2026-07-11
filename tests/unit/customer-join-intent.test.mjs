import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCustomerJoinHref,
  parseCustomerJoinIntent,
} from "@/lib/navigation/customer-join-intent"

test("customer join intent composes QR, referral, and step values", () => {
  const href = buildCustomerJoinHref("old-crown", {
    qrId: "qr/value&proof",
    referralCode: "ref/value&bonus",
    step: "phone",
  })

  assert.equal(
    href,
    "/m/old-crown/join?qr=qr%2Fvalue%26proof&ref=ref%2Fvalue%26bonus&step=phone"
  )
})

test("customer join intent omits blank values and rejects unknown steps", () => {
  assert.deepEqual(
    parseCustomerJoinIntent({ qr: " ", ref: " referral ", step: "forged" }),
    { referralCode: "referral" }
  )
})
