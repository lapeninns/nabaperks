import assert from "node:assert/strict"
import { test } from "node:test"

import {
  OTP_SEND_LABEL,
  OTP_TEXT_FALLBACK_LABEL,
  alternateOtpChannel,
  parseOtpChannel,
  primaryOtpChannel,
} from "@/lib/customer/otp-channel-core"

test("only the two known channels parse; anything else is null", () => {
  assert.equal(parseOtpChannel("sms"), "sms")
  assert.equal(parseOtpChannel("whatsapp"), "whatsapp")
  for (const bad of ["WhatsApp", "email", "", null, undefined, 1]) {
    assert.equal(parseOtpChannel(bad), null)
  }
})

test("WhatsApp is the primary channel unless the environment names SMS", () => {
  assert.equal(primaryOtpChannel(undefined), "whatsapp")
  assert.equal(primaryOtpChannel(""), "whatsapp")
  assert.equal(primaryOtpChannel("nope"), "whatsapp")
  assert.equal(primaryOtpChannel(" SMS "), "sms")
})

test("the alternate channel is the other one, and the guest-facing labels name no channel but text", () => {
  assert.equal(alternateOtpChannel("sms"), "whatsapp")
  assert.equal(alternateOtpChannel("whatsapp"), "sms")
  assert.equal(OTP_SEND_LABEL, "Send my code")
  assert.equal(OTP_TEXT_FALLBACK_LABEL, "Text me instead")
  assert.doesNotMatch(OTP_SEND_LABEL + OTP_TEXT_FALLBACK_LABEL, /whatsapp/i)
})
