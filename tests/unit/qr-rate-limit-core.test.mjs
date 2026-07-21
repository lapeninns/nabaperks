import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isValidPublicQrId,
  qrScanCodeRateLimitKey,
  qrScanIdentityRateLimitKey,
} from "@/lib/customer/qr-rate-limit-core"

test("public QR ids are bounded before rate-limit or database use", () => {
  assert.equal(isValidPublicQrId("old-crown-girton"), true)
  assert.equal(isValidPublicQrId("A_b-9"), true)
  assert.equal(isValidPublicQrId(""), false)
  assert.equal(isValidPublicQrId("a".repeat(129)), false)
  assert.equal(isValidPublicQrId("../../unexpected"), false)
})

test("identity-wide and code-specific QR buckets are independent", () => {
  assert.equal(qrScanIdentityRateLimitKey("client"), "qr-scan:identity:client")
  assert.equal(
    qrScanCodeRateLimitKey("venue-code", "client"),
    "qr-scan:code:venue-code:client"
  )
})
