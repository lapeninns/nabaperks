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
  const hasExactUrl = Array.from(
    candidates,
    ([candidate]) => new URL(candidate)
  ).some((candidate) => candidate.href === expected.href)

  assert.equal(hasExactUrl, true)
}

test("merchant OTP actions expose explicit signup and sign-in state machines", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const state = readProjectFile("lib", "auth", "merchant-auth-action-state.ts")
  const resend = readProjectFile("lib", "auth", "merchant-otp-resend.ts")
  assert.match(actions, /export async function signupOtpAction/)
  assert.match(actions, /export async function passwordResetAction/)
  assert.match(actions, /intent[\s\S]*"verify"[\s\S]*"resend"/)
  assert.match(actions, /intent[\s\S]*"request"[\s\S]*"confirm"/)
  assert.match(actions, /outcome: "verification_unavailable"/)
  assert.match(actions, /outcome: "delivery_unavailable"/)
  assert.doesNotMatch(actions, /password_update_failed/)
  assert.doesNotMatch(actions, /signInWithPassword|resetPasswordForEmail/)
  assert.doesNotMatch(actions, /auth\.updateUser\(\{\s*password/)
  assert.match(actions, /signInWithOtp/)
  assert.match(actions, /verifyOtp/)
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
})

test("merchant auth forms coordinate pending work and use correct live regions", () => {
  const verify = readProjectFile("components", "auth", "signup-verify-form.tsx")
  const reset = readProjectFile("components", "auth", "reset-password-form.tsx")
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
  assert.match(reset, /autoComplete="one-time-code"/)
  assert.match(reset, /name="intent"[\s\S]*value="resend"/)
  assert.match(reset, /OtpResendControl[\s\S]*state\.retryAt/)
  assert.doesNotMatch(reset, /name="password"|new-password|current-password/)
  assert.match(resendControl, /role="status"/)
  assert.match(resendControl, /aria-live="polite"/)
  assert.doesNotMatch(resendControl, /aria-live="assertive"/)
})

test("auth routes preserve safe context and email-code sign-in can resume", () => {
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
  assert.match(actions, /redirect\(context\.next\)/)
  assert.match(rateLimit, /resetAt:/)
  assert.match(hrefs, /\/reset-password/)
})
