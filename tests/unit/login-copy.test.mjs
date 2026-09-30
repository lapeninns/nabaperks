import assert from "node:assert/strict"
import { test } from "node:test"

import {
  LOGIN_COPY,
  LOGIN_MESSAGES,
  loginCodeSentLine,
  loginHeading,
  loginPhonePrefill,
  maskedMobile,
} from "@/lib/customer/login-copy"

/**
 * Returning sign-in (brief section L) in the join flow's words, with no
 * "Welcome back" for a first-time visitor and email never a first choice.
 */

test("Given the number step When /home/login opens Then it reads as joining does, never Welcome back", () => {
  const heading = loginHeading({
    method: "phone",
    noCards: false,
    otpSent: false,
  })
  assert.deepEqual(heading, {
    title: "Open my cards",
    body: "Enter the mobile number you use with Nabaperks.",
  })
  assert.equal(LOGIN_COPY.send, "Send my code")
  assert.equal(LOGIN_COPY.emailSend, "Send code by email")
  assert.equal(LOGIN_COPY.codeLabel, "Your code")
  assert.equal(LOGIN_COPY.continue, "Continue")
})

test("Given a code went out When the code step shows Then it names the real channel and masks the number", () => {
  assert.equal(maskedMobile("+447700900123"), "07•••• ••123")
  assert.equal(maskedMobile("+353851234567"), "the number ending 567")
  assert.equal(
    loginCodeSentLine("+447700900123", "whatsapp"),
    "Sent by WhatsApp to 07•••• ••123."
  )
  assert.equal(
    loginCodeSentLine("+447700900123", "sms"),
    "Sent by text to 07•••• ••123."
  )
  assert.equal(
    loginHeading({
      method: "phone",
      noCards: false,
      otpSent: true,
      contact: "+447700900123",
      channel: "whatsapp",
    }).title,
    "Enter your code"
  )
})

test("Given a valid code for a number with no cards When the step shows Then it says so and points to a venue QR", () => {
  assert.deepEqual(
    loginHeading({ method: "phone", noCards: true, otpSent: false }),
    {
      title: "We couldn't find any cards for this number.",
      body: "Scan the QR at a venue to get your first stamp.",
    }
  )
})

test("Given every sign-in string When it is read Then it has no internal words, emoji, exclamation marks or em dashes", () => {
  const strings = [
    ...Object.values(LOGIN_COPY),
    ...Object.values(LOGIN_MESSAGES),
  ]
  for (const text of strings) {
    assert.doesNotMatch(
      text,
      /wallet|verif|locked|continuity|account|session|!|—|\p{Extended_Pictographic}|instantly|seconds/iu,
      text
    )
  }
})

test("Given a phone resend When the admission may have refused it Then the answer matches join and never claims a code went", () => {
  assert.equal(
    LOGIN_MESSAGES.newCodeSent,
    "If a new code arrives, use the latest one."
  )
  assert.doesNotMatch(LOGIN_MESSAGES.newCodeSent, /^New code sent/)
})

test("Given a stored E.164 number When the guest changes it Then the field shows it as typed, as join does", () => {
  assert.equal(loginPhonePrefill("+447700900123"), "07700 900123")
  // A number still being corrected, or not a UK mobile, is left as typed.
  assert.equal(loginPhonePrefill("07700900123"), "07700900123")
  assert.equal(loginPhonePrefill("123"), "123")
  assert.equal(loginPhonePrefill("+441632960123"), "+441632960123")
  assert.equal(loginPhonePrefill(""), "")
})
