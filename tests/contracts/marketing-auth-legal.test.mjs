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
  const signupVerifyPage = readProjectFile(
    "app",
    "(auth)",
    "signup",
    "verify",
    "page.tsx"
  )
  const resetPasswordPage = readProjectFile(
    "app",
    "(auth)",
    "reset-password",
    "page.tsx"
  )
  const signupVerifyForm = readProjectFile(
    "components",
    "auth",
    "signup-verify-form.tsx"
  )
  const resetPasswordForm = readProjectFile(
    "components",
    "auth",
    "reset-password-form.tsx"
  )
  const authForms = [signupVerifyForm, resetPasswordForm].join("\n")
  const authSurfaces = [
    authActions,
    signupPage,
    signupVerifyPage,
    resetPasswordPage,
  ].join("\n")

  assert.match(alias, /MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 6/)
  assert.match(alias, /merchantEmailOtpAliasDigitLabel/)
  assert.match(alias, /return "six-digit"/)
  assert.doesNotMatch(authSurfaces, /four-digit (?:reset )?code/i)
  assert.match(authActions, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(signupPage, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(signupVerifyPage, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(resetPasswordPage, /merchantEmailOtpAliasDigitLabel\(\)/)
  assert.match(signupVerifyPage, /merchantEmailOtpAliasLength\(\)/)
  assert.match(
    signupVerifyPage,
    /otpLength=\{merchantEmailOtpAliasLength\(\)\}/
  )
  assert.match(resetPasswordPage, /merchantEmailOtpAliasLength\(\)/)
  assert.match(
    resetPasswordPage,
    /otpLength=\{merchantEmailOtpAliasLength\(\)\}/
  )
  assert.doesNotMatch(authForms, /maxLength=\{4\}/)
  assert.match(signupVerifyForm, /maxLength=\{otpLength\}/)
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
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")

  const expectedRoutes = [
    { path: "/privacy", registry: '"/privacy"' },
    { path: "/terms", registry: '"/terms"' },
    { path: "/cookies", registry: '"/cookies"' },
    { path: "/merchant-terms", registry: '"/merchant-terms"' },
    { path: "/data-processing", registry: '"/data-processing"' },
  ]

  assert.match(marketingFacts, /export const PUBLIC_SITE_ROUTES = \[/)
  assert.match(sitemap, /import \{ PUBLIC_SITE_ROUTES \}/)
  assert.doesNotMatch(sitemap, /const routes:/)

  for (const route of expectedRoutes) {
    assert.match(marketingFacts, new RegExp(`path: ${route.registry}`))
    assert.match(llms, new RegExp(`https://nabaperks\\.com${route.path}`))
  }

  assert.doesNotMatch(marketingFacts, /path: ROUTES\.signup/)
  assert.equal(llms.includes("https://nabaperks.com/signup"), false)
  assert.match(signup, /robots: \{ index: false, follow: true \}/)
})
