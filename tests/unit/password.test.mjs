import assert from "node:assert/strict"
import { test } from "node:test"

import {
  passwordRequirements,
  validateConfirmPassword,
  validatePassword,
} from "@/lib/auth/password"

const POLICY_PASSWORD = "lowercase9"

test("validatePassword rejects short, letterless, and digitless passwords", () => {
  assert.equal(validatePassword("abc123"), "Use at least 8 characters.")
  assert.equal(
    validatePassword("12345678"),
    "Use at least one letter and one number."
  )
  assert.equal(
    validatePassword("abcdefgh"),
    "Use at least one letter and one number."
  )
})

test("validatePassword accepts letters plus digits without uppercase or symbols", () => {
  assert.equal(validatePassword(POLICY_PASSWORD), null)
  assert.equal(validatePassword("UPPERCASE9"), null)
  assert.equal(validatePassword("Venue123!"), null)
})

test("passwordRequirements tracks each rule independently", () => {
  assert.deepEqual(passwordRequirements(""), {
    minLength: false,
    hasLetter: false,
    hasDigit: false,
  })
  assert.deepEqual(passwordRequirements("letters"), {
    minLength: false,
    hasLetter: true,
    hasDigit: false,
  })
  assert.deepEqual(passwordRequirements(POLICY_PASSWORD), {
    minLength: true,
    hasLetter: true,
    hasDigit: true,
  })
})

test("validateConfirmPassword only fails when values differ", () => {
  assert.equal(validateConfirmPassword(POLICY_PASSWORD, POLICY_PASSWORD), null)
  assert.equal(
    validateConfirmPassword(POLICY_PASSWORD, "lowercase8"),
    "Passwords do not match."
  )
})
