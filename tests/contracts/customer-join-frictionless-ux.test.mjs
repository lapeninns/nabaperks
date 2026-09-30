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
  assert.match(form, /qrId\s*\?\s*"Add my first stamp"\s*:\s*"Save my card"/)
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

test("the number step names the channel and progress uses the guest's words", () => {
  const form = read("components", "customer", "join-forms.tsx")
  const wizard = read("components", "customer", "join-wizard.tsx")
  const copy = read("lib", "customer", "experience", "copy.ts")

  assert.match(form, /UK mobile number/)
  assert.match(form, /autoComplete="tel"/)
  assert.match(form, /placeholder="07700 900123"/)
  assert.match(form, /joinPhoneChannelNote\(channel\)/)
  assert.match(
    copy,
    /"We send codes by WhatsApp\. You can switch to text on the next screen\."/
  )
  // J2: the retention promise contradicted the optional marketing choice.
  assert.doesNotMatch(`${form}\n${copy}`, /JOIN_PHONE_RETENTION_HINT|No spam/)
  assert.match(wizard, /join_phone: "Your number"/)
  assert.match(wizard, /join_email: "Your email"/)
  assert.match(wizard, /join_otp: "Your code"/)
  assert.doesNotMatch(wizard, /Verify ·/)
})

test("OTP entry normalises pasted codes and gives expiry a direct recovery", () => {
  const actions = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const otp = read("components", "customer", "join-otp-form.tsx")

  // Normalisation moved out of this form and into the one shared OTP field,
  // so the guarantee is pinned in two halves: each surface that asks for a
  // code must use the shared field, and the shared field must be what
  // normalises. Pinning only join-otp-form, as before, said nothing about
  // customer login or the profile gate — and neither of those normalised at
  // all, which is the defect 02#53 recorded.
  const otpInput = read("components", "customer", "customer-otp-input.tsx")
  const login = [
    "customer-login-phone-step.tsx",
    "customer-login-email-step.tsx",
  ]
    .map((file) => read("components", "customer", file))
    .join("\n")
  const profileGate = read("components", "customer", "profile-gate-forms.tsx")

  assert.match(actions, /normalizeOtpInput\(value\(formData, "otp"\)\)/)
  assert.match(
    actions,
    /errors: \{ otp: "That code didn't work\. Check it and try again\." \}/
  )
  // An expired pending code, on verify or on "Send a new code", goes back to
  // the number step with a notice, never "Enter a valid phone number" (J3).
  assert.match(
    actions,
    /if \(isResend && !isTrustedResend\) \{\s*redirect\(codeExpiredHref\(/
  )
  assert.match(
    actions,
    /if \(!pending \|\| pending\.purpose !== "join"\) \{\s*redirect\(codeExpiredHref\(/
  )
  assert.match(actions, /notice: "code_expired"/)
  assert.match(otp, /CustomerOtpInput/)
  assert.match(login, /CustomerOtpInput/)
  assert.match(profileGate, /CustomerOtpInput/)
  assert.match(otpInput, /normalizeOtpInput/)
  assert.match(otpInput, /otpFieldMaxLength/)
  assert.match(otp, /requestState\.errors\?\.contact/)
  assert.match(otp, /Send a new code/)
  assert.match(otp, /Wrong number\? Change it/)
})

test("stamp pages never render caller-controlled blocked copy", () => {
  const page = read("app", "card", "[membershipId]", "stamp", "page.tsx")
  const loader = read("lib", "customer", "experience", "load-stamp.ts")

  assert.doesNotMatch(page, /blocked\?: string/)
  assert.doesNotMatch(loader, /blockedReason|boundedReason/)
})

test("the location policy is disclosed in the legal pack, never as operational detail on a join screen", () => {
  const loader = read("lib", "customer", "experience", "load-join.ts")
  const copy = read("lib", "customer", "experience", "copy.ts")
  const legal = read("lib", "legal", "content.ts")
  const forms = read("components", "customer", "join-forms.tsx")
  const wizard = read("components", "customer", "join-wizard.tsx")

  // The loader still resolves the policy for the stamp flow; the join screens
  // stay guest-facing and point at the venue terms and privacy notice, which
  // carry the disclosure.
  assert.match(loader, /getMerchantStampLocationRequirement/)
  assert.match(legal, /Location checks and suspected misuse/)
  assert.match(legal, /Location information/)
  // Scope the copy check to the join view-models: the stamp screens keep the
  // one-stamp-per-day rule because that one is the guest's own rule.
  const joinCopy = copy.slice(
    copy.indexOf("export const JOIN_WELCOME_HOW_IT_WORKS"),
    copy.indexOf('case "stamp_confirm"')
  )
  for (const source of [joinCopy, forms, wizard]) {
    assert.doesNotMatch(source, /Location checks begin|business day/)
  }
})

test("the consent step keeps required terms and optional marketing as separate unticked controls, with no select-all", () => {
  const form = read("components", "customer", "join-forms.tsx")
  const copy = read("lib", "customer", "experience", "copy.ts")
  const joinForm = form.slice(form.indexOf("export function CustomerJoinForm"))

  // No combined control of any kind (guest journey J6, owner rule).
  assert.doesNotMatch(form, /Yes to all|select-all|selectAll|indeterminate/i)
  assert.doesNotMatch(form, /aria-controls="loyalty-terms marketing-opt-in"/)
  // Exactly two checkboxes, each its own field, both starting unticked.
  assert.equal((joinForm.match(/type="checkbox"/g) ?? []).length, 2)
  assert.match(
    joinForm,
    /const \[loyaltyTermsAccepted, setLoyaltyTermsAccepted\] = useState\(false\)/
  )
  assert.match(
    joinForm,
    /const \[marketingOptIn, setMarketingOptIn\] = useState\(false\)/
  )
  assert.match(
    joinForm,
    /name="loyaltyTerms"[\s\S]*checked=\{loyaltyTermsAccepted\}[\s\S]*setLoyaltyTermsAccepted\(event\.currentTarget\.checked\)/
  )
  assert.match(
    joinForm,
    /name="marketingOptIn"[\s\S]*checked=\{marketingOptIn\}[\s\S]*setMarketingOptIn\(event\.currentTarget\.checked\)/
  )
  // Neither setter is ever called with the other's value or a constant.
  assert.equal((joinForm.match(/setMarketingOptIn\(/g) ?? []).length, 1)
  assert.equal((joinForm.match(/setLoyaltyTermsAccepted\(/g) ?? []).length, 1)
  assert.doesNotMatch(form, /defaultChecked/)

  // Required terms first, then marketing in its own group under "Optional".
  const terms = joinForm.indexOf('name="loyaltyTerms"')
  const optional = joinForm.indexOf("<Eyebrow>Optional</Eyebrow>")
  const marketing = joinForm.indexOf('name="marketingOptIn"')
  assert.ok(terms > -1 && terms < optional && optional < marketing)
  assert.match(joinForm, /<MonoTag tone="accent">Required<\/MonoTag>/)

  // The one material condition of joining, beside the terms; photo ID only
  // when the card data says a reward is age checked.
  assert.match(
    joinForm,
    /joinRewardRequirementLine\(\{ mayNeedPhotoId: rewardMayNeedPhotoId \}\)/
  )
  // Marketing names only channels consent is recorded on.
  assert.match(
    joinForm,
    /joinMarketingOptInLabel\(merchantName, contactChannels\)/
  )
  // With no confirmed channel the optional section, and its field, is left out.
  assert.match(joinForm, /\{marketingLabel \? \(\s*<fieldset/)
  assert.match(copy, /"by WhatsApp or text"/)
  assert.match(copy, /"by email"/)
  assert.match(copy, /"You can change this any time in your profile\."/)
  // No false promises on this step.
  assert.doesNotMatch(
    `${form}\n${copy}`,
    /One tick|Last step|the moment you accept/
  )
})
