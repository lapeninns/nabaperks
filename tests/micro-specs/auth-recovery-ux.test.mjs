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

function assertHasExactUrl(source, expectedUrl) {
  const expected = new URL(expectedUrl)
  const candidates = source.matchAll(/https?:\/\/[^"'\s]+/g)
  const hasExactUrl = Array.from(candidates, ([candidate]) => new URL(candidate)).some(
    (candidate) => candidate.href === expected.href
  )

  assert.equal(hasExactUrl, true)
}

test("merchant OTP actions expose one explicit state machine per flow", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const state = readProjectFile("lib", "auth", "merchant-auth-action-state.ts")
  const resend = readProjectFile("lib", "auth", "merchant-otp-resend.ts")
  const recoveryCleanup = readProjectFile(
    "lib",
    "auth",
    "merchant-recovery-session-cleanup.ts"
  )

  assert.match(actions, /export async function signupOtpAction/)
  assert.match(actions, /export async function passwordResetAction/)
  assert.match(actions, /intent[\s\S]*"verify"[\s\S]*"resend"/)
  assert.match(actions, /intent[\s\S]*"request"[\s\S]*"confirm"/)
  assert.match(actions, /outcome: "verification_unavailable"/)
  assert.match(actions, /outcome: "delivery_unavailable"/)
  assert.match(actions, /outcome: "password_update_failed"/)
  assert.match(
    actions,
    /updateError[\s\S]{0,400}closeFailedMerchantRecoverySession/,
    "a failed password update must close the recovery session"
  )
  assert.match(actions, /supabase\.auth\.signOut\(\{ scope: "local" \}\)/)
  assert.match(
    actions,
    /serviceRole\.auth\.admin\.signOut\(token, "local"\)/
  )
  assert.match(actions, /cleanupFailedMerchantRecoverySession\(accessToken/)
  assert.match(actions, /merchantAuthCookieName\(cookie\.name\)/)
  assert.doesNotMatch(actions, /console\.[a-z]+\([^\n]*accessToken/)
  assert.match(
    actions,
    /try[\s\S]{0,300}updateUser\([\s\S]{0,300}catch[\s\S]{0,300}updateError[\s\S]{0,300}closeFailedMerchantRecoverySession/,
    "thrown and returned password-update failures must share cleanup"
  )
  assert.match(recoveryCleanup, /signOutLocal/)
  assert.match(recoveryCleanup, /signOutAdminLocal/)
  assert.match(recoveryCleanup, /clearBrowserCredentials/)
  assert.match(actions, /Merchant OTP provider send failed/)
  assert.doesNotMatch(actions, /already has a venue account/i)
  assert.match(state, /export const MERCHANT_OTP_OUTCOMES/)
  assert.match(state, /retryAt\?: string/)
  assert.match(resend, /MERCHANT_OTP_RESEND_COOLDOWN_MS = 60_000/)
  assert.match(
    actions,
    /Merchant OTP resend limit failed[\s\S]{0,900}outcome: "verification_unavailable"/
  )
  assert.doesNotMatch(
    actions,
    /resendSignupOtpAction[\s\S]{0,1800}merchant-signup/
  )
})

test("local Supabase email hooks cannot silently target production during browser proof", () => {
  const config = readProjectFile("supabase", "config.toml")
  const localWrapper = readProjectFile("scripts", "supabase-local.mjs")
  const linkedWrapper = readProjectFile("scripts", "supabase-linked.mjs")
  const migrationCheck = readProjectFile(
    "scripts",
    "check-supabase-migrations.mjs"
  )
  const ci = readProjectFile(".github", "workflows", "ci.yml")
  const liveHelper = readProjectFile(
    "tests",
    "e2e",
    "helpers",
    "merchant-auth-recovery-live-db.ts"
  )

  assert.match(config, /uri = "env\(SUPABASE_SEND_EMAIL_HOOK_URI\)"/)
  assertHasExactUrl(
    localWrapper,
    "http://host.docker.internal:3000/api/auth/hooks/send-email"
  )
  assertHasExactUrl(
    linkedWrapper,
    "https://nabaperks.com/api/auth/hooks/send-email"
  )
  assertHasExactUrl(
    migrationCheck,
    "https://nabaperks.com/api/auth/hooks/send-email"
  )
  assertHasExactUrl(
    ci,
    "http://host.docker.internal:3147/api/auth/hooks/send-email"
  )
  assert.match(liveHelper, /GOTRUE_HOOK_SEND_EMAIL_URI/)
  assert.match(liveHelper, /Local merchant auth proof email sink/)
})

test("merchant auth fault cleanup restores the rate-limit RPC to service-role only", () => {
  const liveHelper = readProjectFile(
    "tests",
    "e2e",
    "helpers",
    "merchant-auth-recovery-live-db.ts"
  )
  const rateLimitHelper = liveHelper.match(
    /export async function setMerchantAuthRateLimitRpcAvailable\([\s\S]*?\n}\n\nexport async function allowMerchantAuthProviderSend/
  )?.[0]

  assert.ok(rateLimitHelper)
  assert.equal((rateLimitHelper.match(/grant execute/g) ?? []).length, 1)
  assert.doesNotMatch(
    rateLimitHelper,
    /grant execute on function public\.enforce_rate_limit\([\s\S]{0,180}\) to (?:public|anon|authenticated)/
  )
  assert.match(
    rateLimitHelper,
    /revoke execute on function public\.enforce_rate_limit\([\s\S]{0,180}\) from public, anon, authenticated/
  )
  assert.match(
    rateLimitHelper,
    /grant execute on function public\.enforce_rate_limit\([\s\S]{0,180}\) to service_role/
  )
  assert.match(
    rateLimitHelper,
    /revoke execute on function public\.enforce_rate_limit\([\s\S]{0,180}\) from public, anon, authenticated, service_role/
  )
})

test("merchant auth forms coordinate pending work and use correct live regions", () => {
  const verify = readProjectFile("components", "auth", "signup-verify-form.tsx")
  const reset = readProjectFile("components", "auth", "reset-password-form.tsx")
  const login = readProjectFile("components", "auth", "auth-form.tsx")
  const resendControl = readProjectFile(
    "components",
    "auth",
    "otp-resend-control.tsx"
  )

  assert.equal((verify.match(/useActionState\(/g) ?? []).length, 1)
  assert.equal((reset.match(/useActionState\(/g) ?? []).length, 1)
  assert.match(verify, /signupOtpAction/)
  assert.match(reset, /passwordResetAction/)
  assert.match(verify, /outcome === "sent"[\s\S]*setOtp\(""\)/)
  assert.match(reset, /PasswordRequirements/)
  assert.match(login, /signupOtpAction/)
  assert.match(login, /name="intent"[\s\S]*value="resend"/)
  assert.match(login, /OtpResendControl[\s\S]*freshCodeState\.retryAt/)
  assert.doesNotMatch(login, /Get a fresh code[\s\S]{0,120}<\/a>/)
  assert.match(resendControl, /role="status"/)
  assert.match(resendControl, /aria-live="polite"/)
  assert.doesNotMatch(resendControl, /aria-live="assertive"/)
})

test("auth routes preserve safe context and password reset can resume", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const signupPage = readProjectFile("app", "(auth)", "signup", "page.tsx")
  const verifyPage = readProjectFile(
    "app",
    "(auth)",
    "signup",
    "verify",
    "page.tsx"
  )
  const resetPage = readProjectFile(
    "app",
    "(auth)",
    "reset-password",
    "page.tsx"
  )
  const confirm = readProjectFile("app", "auth", "confirm", "route.ts")
  const hrefs = readProjectFile("lib", "navigation", "merchant-auth-hrefs.ts")
  const rateLimit = readProjectFile("lib", "security", "rate-limit.ts")

  assert.match(hrefs, /export function merchantSignupHref/)
  assert.match(hrefs, /export function merchantLoginHref/)
  assert.match(hrefs, /export function merchantPasswordResetHref/)
  assert.match(hrefs, /export function merchantPasswordResetVerifyHref/)
  assert.match(signupPage, /params\.name/)
  assert.match(signupPage, /safeMerchantNextPath/)
  assert.match(verifyPage, /readMerchantOtpResendCooldown/)
  assert.match(resetPage, /stage[\s\S]*verify/)
  assert.match(confirm, /merchantLoginHref/)
  assert.match(actions, /redirect\(safeMerchantNextPath\(next\)\)/)
  assert.match(rateLimit, /resetAt:/)
  assert.match(hrefs, /\/reset-password/)
})
