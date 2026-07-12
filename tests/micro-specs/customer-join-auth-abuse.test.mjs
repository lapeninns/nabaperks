import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("Given join and wallet OTP provider failures When actions are inspected Then both flows keep retryable feedback in-form", () => {
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const wallet = read("app", "home", "actions.ts")

  for (const action of [join, wallet]) {
    assert.match(action, /verification\.status === "unavailable"/)
    assert.match(action, /couldn.t check that code/i)
  }
  assert.match(join, /referralCode: ref \|\| undefined/)
})

test("Given customer OTP dispatch When policy source is inspected Then GB-only parsing, bounded calls, and identity-wide sends are enforced", () => {
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const phone = read("lib", "customer", "phone.ts")
  const verification = read("lib", "customer", "verification.ts")
  const limits = read("lib", "customer", "otp-rate-limit.ts")
  const envCheck = read("scripts", "check-env.mjs")

  assert.match(phone, /parsed\.country !== "GB"/)
  assert.ok(
    join.indexOf("getMerchantJoinContext") <
      join.indexOf("startCustomerPhoneVerification(contact)"),
    "merchant and QR context must be validated before SMS dispatch"
  )
  assert.match(verification, /AbortSignal\.timeout\(providerTimeoutMs\)/)
  assert.match(verification, /process\.env\.VERCEL_ENV !== "preview"/)
  assert.match(limits, /customerOtpIdentitySendWindowMs/)
  assert.match(limits, /customerOtpSendIdentityRateLimitKey\(requestIdentity\)/)
  assert.match(
    envCheck,
    /CUSTOMER_OTP_BYPASS_MODE must be blank outside local development/
  )
  assert.match(
    envCheck,
    /CUSTOMER_DEV_OTP_CODE must be blank outside local development/
  )
})

test("Given customer OTP entry When challenge dependencies are inspected Then Cloudflare cannot crash or block the phone step", () => {
  const joinAction = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const walletAction = read("app", "home", "actions.ts")
  const joinForm = read("components", "customer", "join-forms.tsx")
  const walletForm = read("components", "customer", "customer-login-form.tsx")
  const csp = read("lib", "security", "csp.ts")
  const envContract = read("config", "env-contract.json")

  for (const source of [joinAction, walletAction]) {
    assert.doesNotMatch(source, /verifyCustomerPhoneChallenge/)
    assert.doesNotMatch(source, /cf-turnstile-response/)
  }

  for (const source of [joinForm, walletForm]) {
    assert.doesNotMatch(source, /CustomerBotChallenge/)
    assert.doesNotMatch(source, /turnstileSiteKey/)
  }

  assert.equal(csp.includes("challenges.cloudflare.com"), false)
  assert.doesNotMatch(envContract, /TURNSTILE/)
})
