import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hasPasswordSymbol,
  passwordRequirements,
  validateConfirmPassword,
  validatePassword,
} from "@/lib/auth/password"

const STRONG_PASSWORD = "Venue123!"

test("validatePassword rejects passwords missing any required character set", () => {
  assert.equal(validatePassword("sho1!A"), "Use at least 8 characters.")
  assert.equal(
    validatePassword("abcdefgh"),
    "Use upper and lower case, a number, and a symbol."
  )
  assert.equal(
    validatePassword("ABCDEFGH1!"),
    "Use upper and lower case, a number, and a symbol."
  )
  assert.equal(
    validatePassword("abcdefgh1!"),
    "Use upper and lower case, a number, and a symbol."
  )
  assert.equal(
    validatePassword("Abcdefgh!"),
    "Use upper and lower case, a number, and a symbol."
  )
  assert.equal(
    validatePassword("Abcdefg1"),
    "Use upper and lower case, a number, and a symbol."
  )
})

test("validatePassword accepts passwords that match Supabase policy", () => {
  assert.equal(validatePassword(STRONG_PASSWORD), null)
  assert.equal(validatePassword("  Venue123!  "), null)
})

test("hasPasswordSymbol only accepts Supabase's allowed symbol set", () => {
  assert.equal(hasPasswordSymbol("Venue123!"), true)
  assert.equal(hasPasswordSymbol("Venue123"), false)
  assert.equal(hasPasswordSymbol("Venue123§"), false)
})

test("passwordRequirements tracks each rule independently", () => {
  assert.deepEqual(passwordRequirements(""), {
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasDigit: false,
    hasSymbol: false,
  })
  assert.deepEqual(passwordRequirements("venue1!"), {
    minLength: false,
    hasLowercase: true,
    hasUppercase: false,
    hasDigit: true,
    hasSymbol: true,
  })
  assert.deepEqual(passwordRequirements(STRONG_PASSWORD), {
    minLength: true,
    hasLowercase: true,
    hasUppercase: true,
    hasDigit: true,
    hasSymbol: true,
  })
})

test("validateConfirmPassword only fails when values differ", () => {
  assert.equal(validateConfirmPassword(STRONG_PASSWORD, STRONG_PASSWORD), null)
  assert.equal(
    validateConfirmPassword(STRONG_PASSWORD, "Venue124!"),
    "Passwords do not match."
  )
})
