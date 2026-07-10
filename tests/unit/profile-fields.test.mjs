/**
 * Tests for the customer profile DOB gate (`lib/customer/profile-fields.ts`).
 *
 * The profile gate (name + date of birth [+ optional verified email]) is the
 * app-layer entry point for a customer's DOB, and it enforces a hard 18+ age
 * gate: an under-age date of birth can never be saved, so an under-age customer
 * can never complete their profile or redeem. (The DB functions
 * `create_reward_scan_token` / `redeem_self_service_reward` enforce the same
 * 18+ rule as a defence-in-depth backstop for any data written before this gate.)
 *
 *   - Section A: minors are REJECTED with the age message ("who can't redeem").
 *   - Section B: adults are accepted ("who can redeem").
 *   - Section C: the exact 18th-birthday boundary.
 *   - Section D: the other DOB rejections (empty / malformed / future / pre-1900).
 *   - Section E: the shared `validateProfileFields` gate end-to-end.
 *   - Section F: `latestAdultBirthDate` (the date-input `max`).
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  MINIMUM_AGE_YEARS,
  latestAdultBirthDate,
  validateDateOfBirth,
  validateProfileFields,
} from "@/lib/customer/profile-fields"

const AGE_ERROR = `You must be ${MINIMUM_AGE_YEARS} or over.`
const DAY_MS = 24 * 60 * 60 * 1000

/** A `YYYY-MM-DD` DOB for someone ~`years` old today (birthday pinned to Jan 1). */
function dobForAge(years) {
  return `${new Date().getUTCFullYear() - years}-01-01`
}

/** The given `YYYY-MM-DD` string plus `days` days, as `YYYY-MM-DD` (UTC). */
function addDays(iso, days) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

describe("DOB gate — Section A: minors are rejected (18+ gate)", () => {
  const minorAges = [1, 5, 10, MINIMUM_AGE_YEARS - 2, MINIMUM_AGE_YEARS - 1]

  for (const age of minorAges) {
    test(`Given a ~${age}-year-old's DOB When validated Then it is rejected as under age`, () => {
      assert.equal(validateDateOfBirth(dobForAge(age)), AGE_ERROR)
    })
  }

  test("Given a minor's otherwise-complete profile When the gate runs Then DOB is flagged (a child cannot redeem)", () => {
    const errors = validateProfileFields({
      fullName: "Timmy Toddler",
      dateOfBirth: dobForAge(6),
      email: "",
    })
    assert.equal(errors.dateOfBirth, AGE_ERROR)
  })
})

describe("DOB gate — Section B: adults are accepted", () => {
  for (const age of [MINIMUM_AGE_YEARS + 1, MINIMUM_AGE_YEARS + 7, 40, 90]) {
    test(`Given a ${age}-year-old's DOB When validated Then it is accepted`, () => {
      assert.equal(validateDateOfBirth(dobForAge(age)), null)
    })
  }
})

describe("DOB gate — Section C: the 18th-birthday boundary", () => {
  test("Given someone turning 18 today When validated Then it is accepted", () => {
    assert.equal(validateDateOfBirth(latestAdultBirthDate()), null)
  })

  test("Given someone one day short of 18 When validated Then it is rejected", () => {
    const oneDayShort = addDays(latestAdultBirthDate(), 1)
    assert.equal(validateDateOfBirth(oneDayShort), AGE_ERROR)
  })

  test("Given UTC has not rolled but London has When validated Then the UK business date wins", () => {
    const londonAfterMidnight = new Date("2026-07-09T23:30:00.000Z")

    assert.equal(latestAdultBirthDate(londonAfterMidnight), "2008-07-10")
    assert.equal(validateDateOfBirth("2008-07-10", londonAfterMidnight), null)
    assert.equal(
      validateDateOfBirth("2008-07-11", londonAfterMidnight),
      AGE_ERROR
    )
  })
})

describe("DOB gate — Section D: the other DOB rejections", () => {
  test("Given an empty DOB When validated Then it is required", () => {
    assert.equal(validateDateOfBirth(""), "Enter your date of birth.")
  })

  for (const malformed of [
    "01/01/2000", // wrong separator / order
    "2000-1-1", // not zero-padded
    "not-a-date",
    "20000101", // no separators
    "2000-13-40", // well-formed shape but impossible calendar date
  ]) {
    test(`Given a malformed DOB "${malformed}" When validated Then it is rejected`, () => {
      assert.equal(
        validateDateOfBirth(malformed),
        "Enter a valid date of birth."
      )
    })
  }

  test("Given a future DOB When validated Then it is rejected as future (before the age check)", () => {
    const now = new Date("2026-07-09T12:00:00.000Z")
    const tomorrow = "2026-07-10"
    assert.equal(
      validateDateOfBirth(tomorrow, now),
      "Date of birth can't be in the future."
    )
  })

  test("Given a pre-1900 DOB When validated Then it is rejected", () => {
    assert.equal(
      validateDateOfBirth("1899-12-31"),
      "Enter a valid date of birth."
    )
  })
})

describe("DOB gate — Section E: profile gate integration", () => {
  test("Given an adult with a name but no email When the gate runs Then the profile is complete", () => {
    const errors = validateProfileFields({
      fullName: "Adult Customer",
      dateOfBirth: dobForAge(30),
      email: "",
    })
    assert.deepEqual(errors, {})
  })

  test("Given a missing name and a minor DOB When the gate runs Then both are flagged", () => {
    const errors = validateProfileFields({
      fullName: "",
      dateOfBirth: dobForAge(9),
      email: "",
    })
    assert.equal(errors.fullName, "Enter your name.")
    assert.equal(errors.dateOfBirth, AGE_ERROR)
  })
})

describe("DOB gate — Section F: latestAdultBirthDate (date-input max)", () => {
  test("Given a fixed date When computed Then it subtracts exactly MINIMUM_AGE_YEARS years", () => {
    const asOf = new Date("2026-07-03T09:00:00Z")
    assert.equal(
      latestAdultBirthDate(asOf),
      `${2026 - MINIMUM_AGE_YEARS}-07-03`
    )
  })

  test("Given today's cutoff When validated Then it is exactly on the accepted side of the gate", () => {
    const cutoff = latestAdultBirthDate()
    assert.match(cutoff, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(validateDateOfBirth(cutoff), null)
    // One day past the cutoff (younger) must fall on the rejected side.
    assert.equal(validateDateOfBirth(addDays(cutoff, 1)), AGE_ERROR)
  })
})
