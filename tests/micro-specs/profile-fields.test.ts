import { describe, expect, it } from "vitest"

import { validateProfileFields } from "@/lib/customer/profile-fields"

describe("validateProfileFields", () => {
  it("flags a missing name", () => {
    expect(
      validateProfileFields({
        fullName: "",
        dateOfBirth: "1990-01-01",
        email: "",
      }).fullName
    ).toBeTruthy()
  })

  it("flags a missing, malformed, or future date of birth", () => {
    expect(
      validateProfileFields({ fullName: "Sam", dateOfBirth: "", email: "" })
        .dateOfBirth
    ).toBeTruthy()
    expect(
      validateProfileFields({
        fullName: "Sam",
        dateOfBirth: "01/01/1990",
        email: "",
      }).dateOfBirth
    ).toBeTruthy()
    expect(
      validateProfileFields({
        fullName: "Sam",
        dateOfBirth: "2999-01-01",
        email: "",
      }).dateOfBirth
    ).toBeTruthy()
  })

  it("flags an invalid email but allows a blank one", () => {
    expect(
      validateProfileFields({
        fullName: "Sam",
        dateOfBirth: "1990-01-01",
        email: "nope",
      }).email
    ).toBeTruthy()
    expect(
      validateProfileFields({
        fullName: "Sam",
        dateOfBirth: "1990-01-01",
        email: "",
      })
    ).toEqual({})
  })

  it("passes a complete, valid set", () => {
    expect(
      validateProfileFields({
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        email: "sam@example.test",
      })
    ).toEqual({})
  })
})
