import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given marketing CTAs When route targets are inspected Then signup and pricing links stay intact", () => {
  // Given
  const hero = readProjectFile("components", "marketing", "landing", "hero.tsx")
  const trustPricing = readProjectFile(
    "components",
    "marketing",
    "landing",
    "trust-pricing.tsx"
  )
  const finalCta = readProjectFile(
    "components",
    "marketing",
    "landing",
    "final-cta.tsx"
  )

  // When / Then
  assert.match(hero, /href="\/signup"/)
  assert.match(trustPricing, /href="\/signup"/)
  assert.match(trustPricing, /href="\/pricing"/)
  assert.match(finalCta, /href="\/signup"/)
  assert.match(finalCta, /href="\/pricing"/)
})

test("Given trust and pricing copy When legal friction is reviewed Then billing and marketing consent are precise", () => {
  // Given
  const trustPricing = readProjectFile(
    "components",
    "marketing",
    "landing",
    "trust-pricing.tsx"
  )
  const finalCta = readProjectFile(
    "components",
    "marketing",
    "landing",
    "final-cta.tsx"
  )
  const proofStrip = readProjectFile(
    "components",
    "marketing",
    "landing",
    "proof-strip.tsx"
  )
  const separateMarketing = readProjectFile(
    "components",
    "marketing",
    "landing",
    "separate-marketing.tsx"
  )
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")

  // When
  const homepagePricingCopy = [trustPricing, finalCta, proofStrip].join("\n")
  const acquisitionCopy = [homepagePricingCopy, signup].join("\n")

  // Then — the marketing-consent precision now lives in its own section.
  assert.match(
    separateMarketing,
    /Customers earn stamps without joining a marketing list\./
  )
  assert.match(
    separateMarketing,
    /without ever agreeing to\s+promotional messages\./
  )
  assert.match(proofStrip, /value: "30 days"/)
  assert.match(proofStrip, /label: "free to pilot"/)
  assert.match(
    acquisitionCopy,
    /billing when you activate your live venue\s+QR|Card required when you activate your live QR/
  )
  assert.match(
    homepagePricingCopy,
    /one or two extra regulars a week can cover/
  )
  assert.doesNotMatch(acquisitionCopy, /free, card required/)
  assert.doesNotMatch(acquisitionCopy, /Card required to go live/)
  assert.doesNotMatch(acquisitionCopy, /card required to activate/)
})

test("Given merchant auth When signup and login are inspected Then passwords pair with one-time email verification", () => {
  // Given
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const authForm = readProjectFile("components", "auth", "auth-form.tsx")
  const resetForm = readProjectFile(
    "components",
    "auth",
    "reset-password-form.tsx"
  )
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const login = readProjectFile("app", "(auth)", "login", "page.tsx")
  const sendEmailHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-email",
    "route.ts"
  )
  const resend = readProjectFile("lib", "notifications", "resend.ts")

  // When
  const authScreens = [authForm, resetForm, signup, login].join("\n")

  // Then — signup creates a password account confirmed by a one-time code,
  // login uses the password, and reset re-verifies by code before updateUser.
  assert.match(actions, /signUp\(/)
  assert.match(actions, /signInWithPassword/)
  assert.match(actions, /verifyOtp/)
  assert.match(actions, /type: "signup"/)
  assert.match(actions, /type: "recovery"/)
  assert.match(actions, /resetPasswordForEmail/)
  assert.match(actions, /updateUser/)
  assert.doesNotMatch(actions, /signInWithOtp/)

  assert.match(authForm, /name="password"/)
  assert.match(authForm, /name="confirmPassword"/)
  assert.match(authForm, /autoComplete="new-password"/)
  assert.match(authForm, /autoComplete="current-password"/)
  assert.match(authForm, /autoComplete="one-time-code"/)
  assert.match(authForm, /Verify email/)
  assert.match(authForm, /Forgot password\?/)

  assert.match(resetForm, /name="password"/)
  assert.match(resetForm, /autoComplete="one-time-code"/)

  assert.match(sendEmailHook, /"merchant-verify"/)
  assert.match(sendEmailHook, /"merchant-reset"/)
  assert.match(sendEmailHook, /email_action_type === "recovery"/)

  assert.match(resend, /Nabaperks merchant/)
  assert.match(resend, /Verify your venue email/)
  assert.match(resend, /Reset your password/)

  assert.match(login, /email and password/i)
  assert.doesNotMatch(authScreens, /verification\s+link/i)
})

test("Given public questions When answers are dry-run against code Then they only claim implemented behavior", () => {
  // Given
  const landingFaq = readProjectFile(
    "components",
    "marketing",
    "landing",
    "faq.tsx"
  )
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const stampAction = readProjectFile(
    "app",
    "card",
    "[membershipId]",
    "actions.ts"
  )
  const stampService = readProjectFile("lib", "customer", "stamp.ts")
  const billingAction = readProjectFile("app", "app", "billing", "actions.ts")
  const launchReadiness = readProjectFile(
    "lib",
    "merchant",
    "launch-readiness.ts"
  )
  const joinAction = readProjectFile(
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )
  const profileMarketing = readProjectFile(
    "components",
    "customer",
    "profile-marketing-consent.tsx"
  )
  const customerReadback = readProjectFile(
    "lib",
    "merchant",
    "customer-readback.ts"
  )
  const billingMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260626090000_require_merchant_billing.sql"
  )
  const publicQuestions = [landingFaq, pricing].join("\n")
  const stampImplementation = [
    stampAction,
    stampService,
    billingMigration,
  ].join("\n")

  // When / Then
  assert.match(landingFaq, /q: "Can staff or customers fake the stamps\?"/)
  assert.match(landingFaq, /Customers stamp themselves from your venue QR/)
  assert.match(landingFaq, /one stamp per customer per UK date/)
  assert.match(pricing, /stamps from your venue QR/)
  assert.match(pricing, /one earned stamp per customer per UK date/)

  assert.doesNotMatch(publicQuestions, /staff-approved/i)
  assert.doesNotMatch(publicQuestions, /staff approval/i)
  assert.doesNotMatch(publicQuestions, /team approves/i)
  assert.doesNotMatch(publicQuestions, /UK GDPR throughout/)
  assert.doesNotMatch(publicQuestions, /nothing is sold/)

  assert.match(stampImplementation, /issueSelfServiceStamp/)
  assert.match(stampImplementation, /"issue_self_service_stamp"/)
  assert.match(stampImplementation, /p_qr_id/)
  assert.match(stampImplementation, /source', 'self_service_qr'/)
  assert.match(
    stampImplementation,
    /Stamp already issued for this UK business day/
  )
  assert.match(stampImplementation, /billing_status/)
  assert.match(stampImplementation, /geo_flagged/)

  assert.match(billingAction, /trial_period_days: 30/)
  assert.match(launchReadiness, /Add a card to activate/)
  assert.match(launchReadiness, /qrCode\?\.is_active === true/)

  assert.match(joinAction, /const marketingOptIn/)
  assert.match(joinAction, /p_marketing_opt_in: marketingOptIn/)
  assert.match(
    profileMarketing,
    /Turning these off won&apos;t affect stamps or rewards/
  )
  assert.match(customerReadback, /masked-safe/)
  assert.match(customerReadback, /Never the raw number/)
})
