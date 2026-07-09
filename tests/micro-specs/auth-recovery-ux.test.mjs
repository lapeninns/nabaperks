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

test("merchant OTP actions expose one explicit state machine per flow", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const state = readProjectFile("lib", "auth", "merchant-auth-action-state.ts")
  const resend = readProjectFile("lib", "auth", "merchant-otp-resend.ts")

  assert.match(actions, /export async function signupOtpAction/)
  assert.match(actions, /export async function passwordResetAction/)
  assert.match(actions, /intent[\s\S]*"verify"[\s\S]*"resend"/)
  assert.match(actions, /intent[\s\S]*"request"[\s\S]*"confirm"/)
  assert.match(actions, /outcome: "verification_unavailable"/)
  assert.match(actions, /outcome: "delivery_unavailable"/)
  assert.match(actions, /outcome: "password_update_failed"/)
  assert.match(state, /export const MERCHANT_OTP_OUTCOMES/)
  assert.match(state, /retryAt\?: string/)
  assert.match(resend, /MERCHANT_OTP_RESEND_COOLDOWN_MS = 60_000/)
  assert.doesNotMatch(
    actions,
    /resendSignupOtpAction[\s\S]{0,1800}merchant-signup/
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
})
