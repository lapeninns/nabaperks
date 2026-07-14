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
  assert.match(form, /Scan at the venue for your first stamp/)
})

test("the welcome and OTP navigation use the composable join-intent builder", () => {
  const welcome = read("components", "customer", "join-welcome-step.tsx")
  const otp = read("components", "customer", "join-otp-form.tsx")

  assert.match(welcome, /buildCustomerJoinHref/)
  assert.match(otp, /buildCustomerJoinHref/)
})

test("stamp pages never render caller-controlled blocked copy", () => {
  const page = read("app", "card", "[membershipId]", "stamp", "page.tsx")
  const loader = read("lib", "customer", "experience", "load-stamp.ts")

  assert.doesNotMatch(page, /blocked\?: string/)
  assert.doesNotMatch(loader, /blockedReason|boundedReason/)
})

test("the verified terms step loads and discloses the merchant location policy", () => {
  const loader = read("lib", "customer", "experience", "load-join.ts")
  const form = read("components", "customer", "join-forms.tsx")

  assert.match(loader, /getMerchantStampLocationRequirement/)
  assert.match(form, /Location checks begin on later qualifying visits/)
})
