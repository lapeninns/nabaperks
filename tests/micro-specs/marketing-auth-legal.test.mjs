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
  // Cancellation renders only via the single-source constant, and the
  // constant always carries the notice period — "cancel anytime" must never
  // appear as a bare literal without the honest qualifier.
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  assert.match(
    facts,
    /cancelLine: "Card required — cancel anytime, one month's notice\."/
  )
  for (const surface of [trustPricing, finalCta, signup]) {
    assert.match(surface, /PRODUCT\.cancelLine/)
  }
  assert.doesNotMatch(acquisitionCopy, /cancel anytime/i)
  assert.match(
    homepagePricingCopy,
    /one or two extra regulars a week can cover/
  )
  assert.doesNotMatch(acquisitionCopy, /No card to start/)
  assert.doesNotMatch(homepagePricingCopy, /No payment to start/)
  assert.doesNotMatch(acquisitionCopy, /free, card required/)
  assert.doesNotMatch(acquisitionCopy, /Card required to go live/)
  assert.doesNotMatch(acquisitionCopy, /card required to activate/)
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
  // The pure readiness domain (builder, predicates, billing copy) lives in
  // launch-readiness-core; launch-readiness.ts is now the server-only data layer
  // that re-exports it.
  const launchReadiness = readProjectFile(
    "lib",
    "merchant",
    "launch-readiness-core.ts"
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

test("Given push consent is stored with other marketing channels When profile data is read Then push is not collapsed into visible email SMS WhatsApp state", () => {
  const profile = readProjectFile("lib", "customer", "profile.ts")
  const profileMarketing = readProjectFile(
    "components",
    "customer",
    "profile-marketing-consent.tsx"
  )

  assert.match(profile, /import type \{ MarketingChannel \}/)
  assert.match(profile, /export type ConsentChannel = MarketingChannel/)
  assert.match(
    profileMarketing,
    /channel: "email" \| "sms" \| "whatsapp" \| "push"/
  )
  assert.match(
    profileMarketing,
    /type DisplayMarketingChannel = Exclude<MarketingConsent\["channel"\], "push">/
  )
  assert.match(
    profileMarketing,
    /const hasAnyConsent = CHANNELS\.some\(\(entry\) =>[\s\S]*optedInByChannel\.has\(entry\.channel\)/
  )
})

test("Given merchant email OTP aliases are six digits When auth copy is reviewed Then no stale four-digit instructions remain", () => {
  const alias = readProjectFile("lib", "auth", "merchant-email-otp-alias.ts")
  const authActions = readProjectFile("app", "(auth)", "actions.ts")
  const signupPage = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const resetPasswordPage = readProjectFile(
    "app",
    "(auth)",
    "reset-password",
    "page.tsx"
  )
  const authForm = readProjectFile("components", "auth", "auth-form.tsx")
  const resetPasswordForm = readProjectFile(
    "components",
    "auth",
    "reset-password-form.tsx"
  )
  const authForms = [authForm, resetPasswordForm].join("\n")
  const authSurfaces = [authActions, signupPage, resetPasswordPage].join("\n")

  assert.match(alias, /MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 6/)
  assert.match(alias, /merchantEmailOtpAliasDigitLabel/)
  assert.match(alias, /return "six-digit"/)
  assert.doesNotMatch(authSurfaces, /four-digit (?:reset )?code/i)
  assert.match(authActions, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(signupPage, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(resetPasswordPage, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(signupPage, /merchantEmailOtpAliasLength\(\)/)
  assert.match(signupPage, /otpLength=\{merchantEmailOtpAliasLength\(\)\}/)
  assert.match(resetPasswordPage, /merchantEmailOtpAliasLength\(\)/)
  assert.match(
    resetPasswordPage,
    /otpLength=\{merchantEmailOtpAliasLength\(\)\}/
  )
  assert.doesNotMatch(authForms, /maxLength=\{4\}/)
  assert.match(authForm, /maxLength=\{otpLength\}/)
  assert.match(resetPasswordForm, /maxLength=\{otpLength\}/)
})

test("Given merchant-specific legal terms are venue-scoped When crawlers inspect the page Then the route is noindexed without review-voice copy", () => {
  const merchantTerms = readProjectFile(
    "app",
    "merchant",
    "[merchantSlug]",
    "terms",
    "page.tsx"
  )

  assert.match(merchantTerms, /import type \{ Metadata \} from "next"/)
  assert.match(merchantTerms, /export const metadata: Metadata = \{/)
  assert.match(merchantTerms, /robots: \{[\s\S]*index: false/)
  assert.match(merchantTerms, /robots: \{[\s\S]*follow: false/)
  assert.doesNotMatch(merchantTerms, /Review required/)
})

test("Given public routes feed SEO and AI discovery When the registry is inspected Then sitemap and llms entries cannot drift", () => {
  const marketingFacts = readProjectFile("lib", "marketing", "facts.ts")
  const sitemap = readProjectFile("app", "sitemap.ts")
  const llms = readProjectFile("public", "llms.txt")

  const expectedRoutes = [
    { path: "/", registry: "ROUTES.home" },
    { path: "/loyalty-for-pubs", registry: "ROUTES.pubHub" },
    { path: "/pricing", registry: "ROUTES.pricing" },
    { path: "/about", registry: "ROUTES.about" },
    {
      path: "/guides/best-loyalty-ideas-for-pubs",
      registry: "ROUTES.guides.bestIdeas",
    },
    {
      path: "/guides/reward-regulars-without-an-app",
      registry: "ROUTES.guides.rewardRegulars",
    },
    {
      path: "/guides/paper-vs-qr-loyalty-for-pubs",
      registry: "ROUTES.guides.paperVsQr",
    },
    { path: "/signup", registry: "ROUTES.signup" },
    { path: "/privacy", registry: '"/privacy"' },
    { path: "/terms", registry: '"/terms"' },
  ]

  assert.match(marketingFacts, /export const PUBLIC_SITE_ROUTES = \[/)
  assert.match(sitemap, /import \{ PUBLIC_SITE_ROUTES \}/)
  assert.doesNotMatch(sitemap, /const routes:/)

  for (const route of expectedRoutes) {
    assert.match(marketingFacts, new RegExp(`path: ${route.registry}`))
    assert.match(
      llms,
      new RegExp(`https://nabaperks\\.com${route.path === "/" ? "\\/" : route.path}`)
    )
  }
})
