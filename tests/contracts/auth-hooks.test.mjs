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

test("Given merchant auth When signup and login are inspected Then access is email-code only", () => {
  // Given
  const actions = readProjectFile("app", "(auth)", "actions.ts")
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
    signupDetailsForm,
    signupVerifyForm,
    resetForm,
    signup,
    login,
  ].join("\n")

  // Then — signup and login both mint sessions from mailbox possession. No
  // product path accepts, stores, verifies, resets, or replaces a password.
  assert.match(actions, /signInWithOtp/)
  assert.match(actions, /verifyOtp/)
  assert.match(actions, /type: "email"/)
  assert.match(actions, /shouldCreateUser: true/)
  assert.match(actions, /shouldCreateUser: context\.flow === "signup"/)
  assert.doesNotMatch(actions, /signInWithPassword|resetPasswordForEmail/)
  assert.doesNotMatch(actions, /auth\.updateUser\(\{\s*password/)

  assert.doesNotMatch(signupDetailsForm, /password/i)
  assert.match(signupVerifyForm, /autoComplete="one-time-code"/)
  assert.match(signupVerifyForm, /Verify email/)
  assert.doesNotMatch(resetForm, /name="password"|new-password/)
  assert.match(resetForm, /autoComplete="one-time-code"/)

  assert.match(sendEmailHook, /"merchant-verify"/)
  assert.match(sendEmailHook, /"merchant-reset"/)
  assert.match(sendEmailHook, /email_action_type === "recovery"/)

  assert.match(resend, /Nabaperks merchant/)
  assert.match(resend, /Verify your venue email/)

  assert.match(login, /email code/i)
  assert.doesNotMatch(authScreens, /verification\s+link/i)
})

test("Given merchant email codes bridge Supabase tokens When aliases resolve Then secrets are scrubbed and tombstones stay bounded", () => {
  const aliasModule = readProjectFile(
    "lib",
    "auth",
    "merchant-email-otp-alias.ts"
  )
  const finalizationMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260710093000_finalize_merchant_email_otp_aliases.sql"
  )

  assert.match(
    aliasModule,
    /createMerchantEmailOtpAlias[\s\S]*create_merchant_email_otp_alias/
  )
  assert.match(
    aliasModule,
    /reserveMerchantEmailOtpAlias[\s\S]*reserve_merchant_email_otp_alias/
  )
  assert.match(
    finalizationMigration,
    /create or replace function public\.purge_merchant_email_otp_aliases/
  )
  assert.match(
    finalizationMigration,
    /set resolution = coalesce\(aliases\.resolution, 'expired'\)[\s\S]*supabase_token = ''/
  )
  assert.match(
    finalizationMigration,
    /delete from public\.merchant_email_otp_aliases aliases[\s\S]*interval '1 day'/
  )
})

test("Given merchant email codes are user-facing When verification is attempted Then aliases are six digits with bounded non-sliding abuse controls", () => {
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
  const finalizationMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260710093000_finalize_merchant_email_otp_aliases.sql"
  )

  assert.match(aliasModule, /MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 6/)
  assert.match(hardeningMigration, /alias_code ~ '\^\[0-9\]\{6\}\$'/)
  assert.match(finalizationMigration, /merchant_email_otp_alias_attempts/)
  assert.match(finalizationMigration, /v_failed_attempt_count >= 20/)
  assert.match(
    finalizationMigration,
    /attempts\.email = normalized_email[\s\S]*attempts\.success = false[\s\S]*interval '15 minutes'/
  )
  assert.match(finalizationMigration, /'\[redacted\]'[\s\S]*false/)
  assert.match(finalizationMigration, /force row level security/)
})

test("Given signup and sign-in verification When provider checks run Then aliases finalize only after success and release on retryable failure", () => {
  const aliasModule = readProjectFile(
    "lib",
    "auth",
    "merchant-email-otp-alias.ts"
  )
  const providerFlow = readProjectFile(
    "lib",
    "auth",
    "merchant-email-otp-provider.ts"
  )
  const actions = readProjectFile("app", "(auth)", "actions.ts")
  const emailHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-email",
    "route.ts"
  )

  assert.match(
    aliasModule,
    /export async function reserveMerchantEmailOtpAlias/
  )
  assert.match(
    aliasModule,
    /export async function finalizeMerchantEmailOtpAlias/
  )
  assert.match(
    aliasModule,
    /export async function releaseMerchantEmailOtpAlias/
  )
  assert.match(aliasModule, /export async function revokeMerchantEmailOtpAlias/)
  assert.doesNotMatch(
    aliasModule,
    /\.rpc\(\s*"consume_merchant_email_otp_alias"/
  )

  assert.match(actions, /reserveMerchantEmailOtpAlias/)
  assert.match(actions, /finalizeMerchantEmailOtpAlias/)
  assert.match(actions, /releaseMerchantEmailOtpAlias/)
  assert.doesNotMatch(actions, /consumeMerchantEmailOtpAlias/)
  assert.match(actions, /runMerchantOtpProviderVerification/)
  assert.match(actions, /reserveMerchantEmailOtpAlias[\s\S]*verifyOtp/)
  assert.match(actions, /purpose: "signup"/)
  assert.doesNotMatch(actions, /purpose: "recovery"/)
  assert.match(providerFlow, /classifyMerchantOtpProviderOutcome/)
  assert.match(providerFlow, /outcome === "retryable"[\s\S]*release/)
  assert.match(providerFlow, /finalize\(outcome\)/)
  assert.match(providerFlow, /runMerchantOtpDelivery/)
  assert.match(providerFlow, /Only an[\s\S]*definitive rejection/)

  assert.match(emailHook, /purpose[\s\S]*email_action_type === "recovery"/)
  assert.match(emailHook, /runMerchantOtpDelivery/)
  assert.match(emailHook, /revokeMerchantEmailOtpAlias/)
  assert.match(emailHook, /delivery_failed/)
})

test("Given auth confirmation accepts a next path When redirects are built Then merchant auth-loop paths use the shared sanitizer", () => {
  const confirmRoute = readProjectFile("app", "auth", "confirm", "route.ts")
  const safeNext = readProjectFile("lib", "navigation", "safe-next-path.ts")

  assert.match(
    safeNext,
    /safeMerchantNextPath\(path: string, fallback = "\/app"\)/
  )
  assert.match(confirmRoute, /import \{ safeMerchantNextPath \}/)
  assert.match(confirmRoute, /const DEFAULT_CONFIRM_NEXT = "\/app\/onboarding"/)
  assert.match(
    confirmRoute,
    /safeMerchantNextPath\([\s\S]*DEFAULT_CONFIRM_NEXT/
  )
  assert.doesNotMatch(confirmRoute, /return `\\$\\{url\\.pathname\\}/)
})

test("Given Supabase auth hooks receive external payloads When the shared envelope opens them Then unsigned or malformed requests fail closed before any provider", () => {
  const envelope = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "signed-hook-envelope.ts"
  )
  const smsHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-sms",
    "route.ts"
  )
  const emailHook = readProjectFile(
    "app",
    "api",
    "auth",
    "hooks",
    "send-email",
    "route.ts"
  )

  // The signature check runs over the raw body before JSON parsing, and a
  // JSON syntax failure returns the Supabase hook error shape.
  assert.match(envelope, /verifyStandardWebhook\(\{/)
  assert.match(envelope, /request\.headers\.get\("webhook-signature"\)/)

  // The body is buffered before the HMAC, so it must be bounded first or an
  // unauthenticated caller decides how much we allocate and hash. Assert the
  // ORDER by index: a regex like /readSignedWebhookBody[\s\S]*verifyStandard/
  // is satisfied by the import line alone and would pass on a regression.
  assert.match(envelope, /readSignedWebhookBody\(request\)/)
  assert.match(envelope, /body === null[\s\S]{0,160}hookError\(413/)
  assert.doesNotMatch(envelope, /request\.text\(\)/)
  const boundedReadAt = envelope.indexOf("await readSignedWebhookBody(request)")
  const verifyAt = envelope.indexOf("verifyStandardWebhook({")
  assert.ok(boundedReadAt > -1, "the envelope reads through the bounded reader")
  assert.ok(
    verifyAt > boundedReadAt,
    "the bounded read must precede HMAC verification"
  )
  assert.match(envelope, /verifyStandardWebhook[\s\S]*let parsedBody: unknown/)
  assert.match(envelope, /hookError\(401, "Invalid signature\."\)/)
  assert.match(envelope, /error instanceof SyntaxError/)
  assert.match(envelope, /hookError\(400, "Malformed payload\."\)/)

  // Both hooks read the payload only through the shared envelope, then parse
  // the provider-specific shape defensively.
  for (const hook of [smsHook, emailHook]) {
    assert.match(hook, /openSignedHookEnvelope\(request, secret\)/)
    assert.match(hook, /if \(!envelope\.ok\)[\s\S]*envelope\.response/)
    assert.doesNotMatch(hook, /JSON\.parse\(/)
    assert.doesNotMatch(hook, /request\.text\(\)/)
  }

  assert.match(smsHook, /parseSendSmsHookPayload\(envelope\.payload\)/)
  assert.match(smsHook, /function parseSendSmsHookPayload\(value: unknown\)/)
  assert.match(smsHook, /if \(!isRecord\(value\)\) return null/)
  assert.match(smsHook, /!Array\.isArray\(value\)/)
  assert.match(smsHook, /stringValue\(value\.user\.phone\)/)
  assert.match(smsHook, /stringValue\(value\.sms\.otp\)/)
  assert.match(emailHook, /parseSendEmailHookPayload\(envelope\.payload\)/)
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
