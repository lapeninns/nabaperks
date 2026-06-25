import { describe, expect, it } from "vitest"

import {
  OTP_MAX_DIGITS,
  OTP_MIN_DIGITS,
  otpFieldMaxLength,
} from "@/lib/customer/experience/otp-field"

/**
 * F20 of the auth-forms friction audit: OTP inputs need a `maxLength` so
 * over-typing fails fast in the browser instead of after a server round-trip.
 * The cap must track the *configured* accepted code length — the server accepts
 * `^\d{4,8}$` (see app/m/[merchantSlug]/join/actions.ts and app/home/actions.ts)
 * — never a hardcoded 6. This pure helper is the single source of that cap so it
 * can be triangulated directly and counted toward coverage.
 */
describe("otpFieldMaxLength (the configured OTP input cap, never a magic number)", () => {
  it("defaults to the server's accepted maximum so any valid code fits", () => {
    expect(otpFieldMaxLength()).toBe(OTP_MAX_DIGITS)
    // The accepted upper bound is the 8 in the server's /^\d{4,8}$/ regex.
    expect(OTP_MAX_DIGITS).toBe(8)
  })

  it("honours a configured code length within the accepted range", () => {
    // The any-4-digits bypass and a 4-digit dev code both fit.
    expect(otpFieldMaxLength(4)).toBe(4)
    // A different configured length generalises rather than hardcoding one value.
    expect(otpFieldMaxLength(6)).toBe(6)
  })

  it("clamps an out-of-range configured length to the accepted bounds", () => {
    expect(otpFieldMaxLength(2)).toBe(OTP_MIN_DIGITS)
    expect(otpFieldMaxLength(12)).toBe(OTP_MAX_DIGITS)
    expect(OTP_MIN_DIGITS).toBe(4)
  })

  it("ignores a non-finite configured length and falls back to the maximum", () => {
    expect(otpFieldMaxLength(Number.NaN)).toBe(OTP_MAX_DIGITS)
    expect(otpFieldMaxLength(undefined)).toBe(OTP_MAX_DIGITS)
  })
})
