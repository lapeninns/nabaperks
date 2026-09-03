import assert from "node:assert/strict"
import { test } from "node:test"

import { classifySendEmailAction } from "@/lib/auth/send-email-action-core"
import { emailOtpCopy } from "@/lib/notifications/email-otp-copy"

test("signup email actions retain verification copy and record account creation", () => {
  assert.deepEqual(classifySendEmailAction("signup"), {
    audience: "merchant-verify",
    purpose: "signup",
    recordsAccountCreation: true,
  })
  assert.match(
    emailOtpCopy["merchant-verify"].intro,
    /creating your venue account/i
  )
})

test("existing-user magic links keep alias compatibility with neutral sign-in copy", () => {
  assert.deepEqual(classifySendEmailAction("magiclink"), {
    audience: "merchant-access",
    purpose: "signup",
    recordsAccountCreation: false,
  })

  const copy = Object.values(emailOtpCopy["merchant-access"]).join(" ")
  assert.match(copy, /sign-in|open your venue console/i)
  assert.doesNotMatch(copy, /signup|creating|account|password/i)
})

test("recovery copy describes passwordless access recovery", () => {
  assert.deepEqual(classifySendEmailAction("recovery"), {
    audience: "merchant-reset",
    purpose: "recovery",
    recordsAccountCreation: false,
  })

  const copy = Object.values(emailOtpCopy["merchant-reset"]).join(" ")
  assert.match(copy, /recover access/i)
  assert.doesNotMatch(copy, /password/i)
})

test("missing, unknown, prototype-key and case-variant actions are rejected", () => {
  for (const action of [
    undefined,
    "",
    "invite",
    "constructor",
    "toString",
    "__proto__",
    "SIGNUP",
    " signup ",
  ]) {
    assert.equal(classifySendEmailAction(action), null)
  }
})
