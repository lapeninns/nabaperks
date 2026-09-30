import assert from "node:assert/strict"
import { test } from "node:test"

import {
  otpFieldDigits,
  otpFieldMaxLength,
} from "@/lib/customer/experience/otp-field"

/**
 * QA BUG-050: what the shared OTP field keeps from pasted or typed text.
 * The field no longer carries a `maxlength` attribute (the browser cut a
 * pasted message to 8 characters before normalisation saw it), so this
 * helper owns both the digit extraction and the cap.
 */
const MAX = otpFieldMaxLength()

test("a pasted code keeps its digits whatever surrounds it", () => {
  for (const [pasted, expected] of [
    ["123456", "123456"],
    ["123456 ", "123456"],
    ["  123456  ", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    ["12 34 56 ", "123456"],
    ["Code: 123456", "123456"],
    ["G-123456", "123456"],
    ["Your code is 123456", "123456"],
    ["Your Nabaperks code is 123456. It expires in 10 minutes.", "123456"],
    ["Nabaperks: 3 stamps. Your code is 123456", "123456"],
  ]) {
    assert.equal(otpFieldDigits(pasted, MAX), expected, JSON.stringify(pasted))
  }
})

test("a code of the accepted length is taken from a message with other numbers", () => {
  assert.equal(otpFieldDigits("Code 4321, valid 10 min", MAX), "4321")
  assert.equal(otpFieldDigits("Your code is 12345678", MAX), "12345678")
})

test("typing a digit at a time keeps every digit up to the cap", () => {
  let value = ""
  for (const digit of "1234567890") {
    value = otpFieldDigits(value + digit, MAX)
  }
  assert.equal(value, "12345678")
  assert.equal(otpFieldDigits("1", MAX), "1")
  assert.equal(otpFieldDigits("12a", MAX), "12")
  assert.equal(otpFieldDigits("", MAX), "")
})

test("a digit run longer than the cap is truncated to the cap", () => {
  assert.equal(otpFieldDigits("1234567890", MAX), "12345678")
  assert.equal(otpFieldDigits("123456", otpFieldMaxLength(4)), "1234")
})
