import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u
const stripWordmark = (source: string) => source.replaceAll("✱", "")

/**
 * Merchant auth surface redesign contracts (McAuth reference parity).
 *
 * The auth form adopts the McAuth Wet Ink layout — VenueMark masthead, mono
 * Eyebrow field labels, ink-bordered wells, a full-width tactile submit — while
 * keeping the PRODUCTION mechanic (Supabase email + password). The reference's
 * passwordless email→OTP is a prototype mechanic; production mechanics win, so
 * no passwordless/OTP path is introduced into merchant auth. Source-analysis.
 */
describe("merchant auth redesign contracts", () => {
  it("uses the McAuth Wet Ink layout — VenueMark masthead and mono field labels", () => {
    const form = read("components/auth/auth-form.tsx")

    expect(form).toContain("VenueMark")
    expect(form).toContain("Eyebrow")
    expect(form).toContain("FormField")
    // Ink-bordered wells (McField) and a full-width tactile submit.
    expect(form).toContain("border-2 border-ink")
    expect(form).toContain("w-full")
  })

  it("keeps pressable targets at least 44px for touch", () => {
    const form = read("components/auth/auth-form.tsx")

    // The mode-switch link is padded to a ≥44px touch target; fields are h-12
    // and the shared Button default is h-11.
    expect(form).toContain("min-h-11")
    expect(form).toContain("h-12")
  })

  it("preserves the production email + password mechanic (no passwordless OTP)", () => {
    const actions = read("app/(auth)/actions.ts")
    const form = read("components/auth/auth-form.tsx")

    // Production mechanic wins over the McAuth passwordless prototype.
    expect(actions).toContain("signInWithPassword")
    expect(actions).toContain("signUp")
    expect(actions).not.toContain("signInWithOtp")
    expect(actions).not.toContain("verifyOtp")

    // The form keeps a real password field; no OTP boxes on merchant auth.
    expect(form).toContain('name="password"')
    expect(form).not.toContain("OtpBoxes")
    expect(form).not.toContain("OtpInput")
  })

  it("wires both auth routes to the shared form with the right mode", () => {
    const login = read("app/(auth)/login/page.tsx")
    const signup = read("app/(auth)/signup/page.tsx")

    expect(login).toContain("AuthForm")
    expect(login).toContain('mode="sign-in"')
    expect(signup).toContain("AuthForm")
    expect(signup).toContain('mode="sign-up"')
  })

  it("keeps auth copy free of emoji and raw w-* motion", () => {
    const form = read("components/auth/auth-form.tsx")

    expect(stripWordmark(form), "auth-form contains an emoji").not.toMatch(
      EMOJI
    )
    expect(form).not.toMatch(/animate-\[w-|animation:\s*["']w-/)
  })
})
