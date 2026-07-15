import assert from "node:assert/strict"
import { test } from "node:test"

import {
  normalizeOtpInput,
  otpFieldMaxLength,
} from "@/lib/customer/experience/otp-field"

test("OTP input keeps digits from formatted and pasted codes", () => {
  assert.equal(normalizeOtpInput("12 34-56"), "123456")
  assert.equal(normalizeOtpInput("1a2b3c4d"), "1234")
})

test("OTP field limits stay within the accepted server range", () => {
  assert.equal(otpFieldMaxLength(), 8)
  assert.equal(otpFieldMaxLength(3), 4)
  assert.equal(otpFieldMaxLength(9), 8)
})
