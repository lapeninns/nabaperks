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

test("Given merchant auth When signup and login are inspected Then passwords pair with one-time email verification", () => {
  // Given
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const authForm = readProjectFile("components", "auth", "auth-form.tsx")
  const signupDetailsForm = readProjectFile(
    "components",
    "auth",
    "signup-details-form.tsx"
  )
  const signupVerifyForm = readProjectFile(
    "components",
    "auth",
    "signup-verify-form.tsx"
  )
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
  const authScreens = [
    authForm,
    signupDetailsForm,
    signupVerifyForm,
    resetForm,
    signup,
    login,
  ].join("\n")

  // Then — signup creates a password account confirmed by a one-time code,
  // login uses the password, and reset re-verifies by code before updateUser.
  assert.match(actions, /validatePassword/)
  assert.match(actions, /from "@\/lib\/auth\/password"/)
  assert.match(actions, /signInWithPassword/)
  assert.match(actions, /verifyOtp/)
  assert.match(actions, /type: "signup"/)
  assert.match(actions, /type: "recovery"/)
  assert.match(actions, /resetPasswordForEmail/)
  assert.match(actions, /updateUser/)
  assert.doesNotMatch(actions, /signInWithOtp/)

  assert.match(signupDetailsForm, /name="password"/)
  assert.match(signupDetailsForm, /name="confirmPassword"/)
  assert.match(signupDetailsForm, /PasswordRequirements/)
  assert.match(signupDetailsForm, /validatePassword/)
  assert.match(signupDetailsForm, /autoComplete="new-password"/)
  assert.match(authForm, /autoComplete="current-password"/)
  assert.match(signupVerifyForm, /autoComplete="one-time-code"/)
  assert.match(signupVerifyForm, /Verify email/)
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

test("Given merchant email codes bridge Supabase tokens When aliases expire or are consumed Then retention is bounded", () => {
  const aliasModule = readProjectFile(
    "lib",
    "auth",
    "merchant-email-otp-alias.ts"
  )
  const cleanupMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260630122000_cleanup_merchant_email_otp_aliases.sql"
  )

  assert.match(aliasModule, /purge_merchant_email_otp_aliases/)
  assert.match(
    aliasModule,
    /createMerchantEmailOtpAlias[\s\S]*await purgeMerchantEmailOtpAliases\(supabase, now\)/
  )
  assert.match(
    aliasModule,
    /consumeMerchantEmailOtpAlias[\s\S]*await purgeMerchantEmailOtpAliases\(supabase, new Date\(\)\)/
  )
  assert.match(
    cleanupMigration,
    /create or replace function public\.purge_merchant_email_otp_aliases/
  )
  assert.match(
    cleanupMigration,
    /delete from public\.merchant_email_otp_aliases aliases[\s\S]*aliases\.expires_at <= p_now/
  )
  assert.match(cleanupMigration, /set consumed_at = now\(\),\s+supabase_token = ''/)
  assert.match(cleanupMigration, /for update skip locked/)
})

test("Given merchant email codes are user-facing When verification is attempted Then aliases are six digits and lock out per email", () => {
  const aliasModule = readProjectFile(
    "lib",
    "auth",
    "merchant-email-otp-alias.ts"
  )
  const hardeningMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260630124000_harden_merchant_email_otp_aliases.sql"
  )

  assert.match(aliasModule, /MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 6/)
  assert.match(hardeningMigration, /alias_code ~ '\^\[0-9\]\{6\}\$'/)
  assert.match(hardeningMigration, /merchant_email_otp_alias_attempts/)
  assert.match(hardeningMigration, /failed_attempt_count >= 5/)
  assert.match(
    hardeningMigration,
    /attempts\.email = normalized_email[\s\S]*attempts\.success = false[\s\S]*interval '15 minutes'/
  )
  assert.match(hardeningMigration, /force row level security/)
})

test("Given auth confirmation accepts a next path When redirects are built Then merchant auth-loop paths use the shared sanitizer", () => {
  const confirmRoute = readProjectFile(
    "app",
    "auth",
    "confirm",
    "route.ts"
  )
  const safeNext = readProjectFile("lib", "navigation", "safe-next-path.ts")

  assert.match(safeNext, /safeMerchantNextPath\(path: string, fallback = "\/app"\)/)
  assert.match(confirmRoute, /import \{ safeMerchantNextPath \}/)
  assert.match(confirmRoute, /const DEFAULT_CONFIRM_NEXT = "\/app\/onboarding"/)
  assert.match(confirmRoute, /safeMerchantNextPath\([\s\S]*DEFAULT_CONFIRM_NEXT/)
  assert.doesNotMatch(confirmRoute, /return `\\$\\{url\\.pathname\\}/)
})

test("Given Supabase auth SMS hooks receive external payloads When payloads are parsed Then malformed objects fail closed before Twilio", () => {
  const smsHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-sms",
    "route.ts"
  )

  assert.match(smsHook, /let parsedBody: unknown/)
  assert.match(smsHook, /parseSendSmsHookPayload\(parsedBody\)/)
  assert.match(smsHook, /function parseSendSmsHookPayload\(value: unknown\)/)
  assert.match(smsHook, /if \(!isRecord\(value\)\) return null/)
  assert.match(smsHook, /!Array\.isArray\(value\)/)
  assert.match(smsHook, /stringValue\(value\.user\.phone\)/)
  assert.match(smsHook, /stringValue\(value\.sms\.otp\)/)
  assert.doesNotMatch(smsHook, /JSON\.parse\(body\) as SendSmsHookPayload/)
})

test("Given Supabase email hooks need Resend When provider config is missing Then aliases are not retained for undelivered codes", () => {
  const emailHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-email",
    "route.ts"
  )
  const resend = readProjectFile("lib", "notifications", "resend.ts")

  assert.match(resend, /export function readEmailOtpConfig/)
  assert.match(
    emailHook,
    /readEmailOtpConfig\(\)[\s\S]*createMerchantEmailOtpAlias/
  )
})
