import assert from "node:assert/strict"
import { test } from "node:test"

import {
  alternateOtpChannel,
  otpChannelPhrase,
  otpChannelSendLabel,
  otpChannelSwitchLabel,
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

test("the alternate channel is the other one, and the copy names the destination", () => {
  assert.equal(alternateOtpChannel("sms"), "whatsapp")
  assert.equal(alternateOtpChannel("whatsapp"), "sms")
  assert.equal(otpChannelPhrase("sms"), "by text")
  assert.equal(otpChannelPhrase("whatsapp"), "on WhatsApp")
  assert.equal(otpChannelSwitchLabel("whatsapp"), "Send it on WhatsApp instead")
  assert.equal(otpChannelSwitchLabel("sms"), "Text me instead")
  assert.equal(otpChannelSendLabel("whatsapp"), "Send my code on WhatsApp")
  assert.equal(otpChannelSendLabel("sms"), "Text me the code")
})
