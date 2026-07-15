import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("join screens distinguish QR stamping from direct card saving", () => {
  const wizard = read("components", "customer", "join-wizard.tsx")
  const form = read("components", "customer", "join-forms.tsx")

  assert.match(wizard, /qrId\s*\?\s*\([\s\S]*?<TermsFirstStampPreview/)
  assert.match(form, /qrId\s*\?\s*"Get my first stamp"\s*:\s*"Save my card"/)
  assert.match(form, /joinCompletionHint/)
})

test("the welcome and OTP navigation use the composable join-intent builder", () => {
  const welcome = read("components", "customer", "join-welcome-step.tsx")
  const otp = read("components", "customer", "join-otp-form.tsx")

  assert.match(welcome, /buildCustomerJoinHref/)
  assert.match(otp, /buildCustomerJoinHref/)
})

test("the welcome prioritises one phone action before supporting detail", () => {
  const welcome = read("components", "customer", "join-welcome-step.tsx")
  const primaryAction = welcome.indexOf("<Button asChild")
  const howItWorks = welcome.indexOf("<HowItWorksList")
  const venueTerms = welcome.indexOf("<CustomerVenueTermsSheet")
  const phoneDestinations = welcome.match(/step: "phone"/g) ?? []

  assert.ok(primaryAction > -1)
  assert.ok(primaryAction < howItWorks)
  assert.ok(howItWorks < venueTerms)
  assert.equal(phoneDestinations.length, 1)
  assert.match(welcome, /JOIN_WELCOME_PHONE_REASSURANCE/)
})

test("venue terms stay inside a hydrated client boundary", () => {
  const legalSheet = read("components", "customer", "legal-sheet.tsx")

  assert.match(legalSheet, /^"use client"/)
  assert.match(legalSheet, /<SheetTrigger asChild>/)
})

test("phone verification keeps retention context and distinct progress labels", () => {
  const form = read("components", "customer", "join-forms.tsx")
  const wizard = read("components", "customer", "join-wizard.tsx")

  assert.match(form, /UK phone number/)
  assert.match(form, /JOIN_PHONE_RETENTION_HINT/)
  assert.match(wizard, /Verify number · Phone/)
  assert.match(wizard, /Verify number · Code/)
})

test("OTP entry normalises pasted codes and gives expiry a direct recovery", () => {
  const actions = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const otp = read("components", "customer", "join-otp-form.tsx")

  assert.match(actions, /normalizeOtpInput\(value\(formData, "otp"\)\)/)
  assert.match(actions, /errors: \{ otp: "That code was not accepted\." \}/)
  assert.match(actions, /That code has expired\. Request a new one\./)
  assert.match(otp, /normalizeOtpInput/)
  assert.match(otp, /requestState\.errors\?\.contact/)
  assert.match(otp, /Request a new code/)
  assert.match(otp, /Wrong number\? Use a different one/)
})

test("stamp pages never render caller-controlled blocked copy", () => {
  const page = read("app", "card", "[membershipId]", "stamp", "page.tsx")
  const loader = read("lib", "customer", "experience", "load-stamp.ts")

  assert.doesNotMatch(page, /blocked\?: string/)
  assert.doesNotMatch(loader, /blockedReason|boundedReason/)
})

test("the verified terms step loads and discloses the merchant location policy", () => {
  const loader = read("lib", "customer", "experience", "load-join.ts")
  const copy = read("lib", "customer", "experience", "copy.ts")

  assert.match(loader, /getMerchantStampLocationRequirement/)
  assert.match(copy, /Location checks begin on later qualifying visits/)
})
