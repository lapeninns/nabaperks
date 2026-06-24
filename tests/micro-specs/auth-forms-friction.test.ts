import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

const LOGIN = "components/customer/customer-login-form.tsx"
const JOIN_OTP = "components/customer/join-otp-form.tsx"
const JOIN = "components/customer/join-forms.tsx"
const PROFILE_ABOUT = "components/customer/profile-about-you.tsx"
const PROFILE_GATE = "components/customer/profile-gate-forms.tsx"

/**
 * Auth / onboarding / profile form friction (cluster: auth-forms).
 * These are source-structure assertions because this repo runs Vitest in the
 * "node" environment with no jsdom — components are read as strings, never
 * rendered. They pin the accessibility + ergonomics wiring without touching the
 * accessible names / visible button text the Playwright specs locate by.
 */
describe("auth-forms friction", () => {
  describe("F6 — OTP / first-field autofocus on arrival", () => {
    it("autofocuses the home-login OTP input once a code has been sent", () => {
      const src = readProjectFile(LOGIN)
      const otpBlock = src.slice(src.indexOf('id="otp"'))
      expect(otpBlock).toContain("autoFocus")
    })

    it("autofocuses the profile email-verify OTP input", () => {
      const src = readProjectFile(PROFILE_ABOUT)
      const otpBlock = src.slice(src.indexOf('id="home-profile-otp"'))
      expect(otpBlock).toContain("autoFocus")
    })

    it("autofocuses the join phone input so the keyboard opens on arrival", () => {
      const src = readProjectFile(JOIN)
      const contactBlock = src.slice(src.indexOf('id="contact"'))
      expect(contactBlock).toContain("autoFocus")
    })

    it("leaves the home-login phone field unfocused (phone + code share a screen)", () => {
      const src = readProjectFile(LOGIN)
      // The phone field block ends where the OTP block begins.
      const phoneBlock = src.slice(
        src.indexOf('id="contact"'),
        src.indexOf('id="otp"')
      )
      expect(phoneBlock).not.toContain("autoFocus")
    })
  })

  describe("F7 — OTP errors are announced and associated with the input", () => {
    it("announces the join OTP error via role=alert and wires aria-describedby", () => {
      const src = readProjectFile(JOIN_OTP)
      expect(src).toContain('role="alert"')
      expect(src).toContain('aria-live="assertive"')
      expect(src).toContain('id="otp-error"')
      expect(src).toContain("aria-describedby")
      // The polite "Sent to" / resend status is a live region too.
      expect(src).toContain('aria-live="polite"')
    })

    it("announces the home-login OTP error and references the error id", () => {
      const src = readProjectFile(LOGIN)
      const otpBlock = src.slice(src.indexOf('id="otp"'))
      expect(otpBlock).toContain('role="alert"')
      expect(otpBlock).toContain('aria-live="assertive"')
      expect(otpBlock).toContain('id="otp-error"')
      expect(otpBlock).toContain("aria-describedby")
    })
  })

  describe("F20 — OTP inputs cap typing at the configured code length", () => {
    it("derives the join OTP maxLength from the helper, not a literal", () => {
      const src = readProjectFile(JOIN_OTP)
      expect(src).toContain("otpFieldMaxLength")
      expect(src).toContain("maxLength")
      // No hardcoded 6 (or any digit literal) on the maxLength prop.
      expect(src).not.toMatch(/maxLength=\{?\s*\d/)
    })

    it("derives the home-login OTP maxLength from the helper", () => {
      const src = readProjectFile(LOGIN)
      expect(src).toContain("otpFieldMaxLength")
      expect(src).not.toMatch(/maxLength=\{?\s*\d/)
    })

    it("derives the profile-gate OTP maxLength from the helper", () => {
      const src = readProjectFile(PROFILE_GATE)
      expect(src).toContain("otpFieldMaxLength")
      expect(src).not.toMatch(/maxLength=\{?\s*\d/)
    })
  })

  describe("F23 — pending async actions are announced politely", () => {
    it("announces the join phone-code request with a polite live status", () => {
      const src = readProjectFile(JOIN)
      // A polite live region carries the pending message alongside the button.
      expect(src).toContain('aria-live="polite"')
      expect(src).toContain("Sending your code")
      // Double-submit prevention is preserved.
      expect(src).toContain("disabled={requestPending}")
    })
  })
})
