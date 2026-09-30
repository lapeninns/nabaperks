import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { beforeEach, test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-064: on merchant /login the resend wait must be visible whenever the
 * server refuses or keeps a cooldown. The real server actions, action-state
 * helpers, rate-limit scoping and navigation helpers run; the rate-limit
 * store, Supabase and the alias store are in-memory stand-ins.
 *
 * The form (components/auth/reset-password-form.tsx) renders the code step
 * and its resend countdown from `context.step === "verify"` and `retryAt`, so
 * those two fields are the rendered contract asserted here.
 */

const REAL = new Set([
  "@/lib/auth/merchant-auth-action-state",
  "@/lib/auth/merchant-auth-rate-limit-core",
  "@/lib/auth/merchant-email-otp-provider",
  "@/lib/navigation/merchant-auth-hrefs",
  "@/lib/navigation/safe-next-path",
])

const STUBS = {
  "fixture-state": `export const state = {
    headers: new Headers({ "x-forwarded-for": "203.0.113.20" }),
    resendRetryAt: undefined,
    resendBlocked: false,
    resendReads: [],
    otpRequests: [],
    reservations: [],
  };`,
  "server-only": "",
  "next/headers": `import { state } from "fixture-state";
    export async function headers() { return state.headers }`,
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "@/lib/analytics/funnel-events":
    "export function recordMerchantFunnelEventSafely() {}",
  "@/lib/security/rate-limit": `export class RateLimitError extends Error {}
    export async function enforceRateLimit() {}
    export async function peekRateLimit() { return { remaining: 1, resetAt: null } }
    export function rateLimitIdentityFromHeaders(headers) { return headers.get("x-forwarded-for") ?? "unknown" }`,
  "@/lib/auth/merchant-otp-resend": `import { state } from "fixture-state";
    import { RateLimitError } from "@/lib/security/rate-limit";
    export class MerchantOtpResendRateLimitError extends RateLimitError {
      constructor(retryAt) { super("Too many code sends."); this.retryAt = retryAt }
    }
    export async function enforceMerchantOtpResend() {
      if (state.resendBlocked) throw new MerchantOtpResendRateLimitError(state.resendRetryAt);
      state.resendBlocked = true;
      state.resendRetryAt = new Date(Date.now() + 60_000).toISOString();
      return { retryAt: state.resendRetryAt };
    }
    export async function readMerchantOtpResendCooldown(input) {
      state.resendReads.push(input);
      return state.resendBlocked ? state.resendRetryAt : undefined;
    }
    export async function enforceInitialSignupRecipientBudget() {}
    export async function recordInitialSignupOtpCooldown() { return { retryAt: undefined } }`,
  "@/lib/supabase/server": `import { state } from "fixture-state";
    export async function createSupabaseServerClient() {
      return { auth: {
        async signInWithOtp(input) { state.otpRequests.push(input); return { error: null } },
        async verifyOtp() { return { error: { status: 403, code: "otp_expired" }, data: {} } },
      } }
    }`,
  "@/lib/auth/merchant-email-otp-alias": `import { state } from "fixture-state";
    export function merchantEmailOtpAliasLength() { return 6 }
    export function merchantEmailOtpAliasDigitLabel() { return "6-digit" }
    export async function reserveMerchantEmailOtpAlias(input) {
      state.reservations.push(input);
      return { status: "invalid" };
    }
    export async function finalizeMerchantEmailOtpAlias() { return true }
    export async function releaseMerchantEmailOtpAlias() { return true }`,
}

async function loadActions() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export { passwordResetAction } from "./app/(auth)/actions.ts"; export { state } from "fixture-state";',
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "merchant-auth-action-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : undefined
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => {
              assert.ok(id in STUBS, `Unrecognised boundary: ${id}`)
              return { contents: STUBS[id], resolveDir: root }
            }
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

const EMAIL = "owner@venue.example"

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const idleRequestState = {
  outcome: "idle",
  context: { flow: "signin", step: "request", email: "", next: "/app" },
}

let actions
beforeEach(async () => {
  actions = await loadActions()
})

test("Given a code was requested moments ago When a fresh /login tab requests another Then the answer opens the code step with the running wait", async () => {
  const { passwordResetAction, state } = actions
  state.resendBlocked = true
  state.resendRetryAt = new Date(Date.now() + 42_000).toISOString()

  const result = await passwordResetAction(
    idleRequestState,
    form({ intent: "request", email: EMAIL, next: "/app" })
  )

  assert.equal(result.outcome, "throttled")
  assert.equal(result.retryAt, state.resendRetryAt, "the wait is returned")
  assert.equal(
    result.context.step,
    "verify",
    "the code step, which renders the countdown, is shown"
  )
  assert.equal(result.context.email, EMAIL)
  assert.equal(state.otpRequests.length, 0, "no provider request is made")
  assert.match(result.errors?.form ?? "", /wait shown below/)
})

test("Given a code was just sent When a wrong code is entered Then the resend wait is carried on the answer", async () => {
  const { passwordResetAction, state } = actions

  const sent = await passwordResetAction(
    idleRequestState,
    form({ intent: "request", email: EMAIL, next: "/app" })
  )
  assert.equal(sent.outcome, "sent")
  assert.ok(sent.retryAt)

  const wrong = await passwordResetAction(
    sent,
    form({ intent: "confirm", email: EMAIL, next: "/app", otp: "000000" })
  )
  assert.equal(wrong.outcome, "invalid")
  assert.match(wrong.errors?.otp ?? "", /does not match/)
  assert.equal(
    wrong.retryAt,
    sent.retryAt,
    "the resend countdown keeps running after a wrong code"
  )
  assert.equal(state.resendReads.at(-1)?.email, EMAIL)
  assert.equal(state.resendReads.at(-1)?.purpose, "signin")
})

test("Given a code was just sent When a malformed code is entered Then the resend wait is still carried", async () => {
  const { passwordResetAction } = actions
  const sent = await passwordResetAction(
    idleRequestState,
    form({ intent: "request", email: EMAIL, next: "/app" })
  )

  const malformed = await passwordResetAction(
    sent,
    form({ intent: "confirm", email: EMAIL, next: "/app", otp: "12" })
  )
  assert.equal(malformed.outcome, "invalid")
  assert.equal(malformed.retryAt, sent.retryAt)
})

test("Given no cooldown is running When a wrong code is entered Then no wait is invented", async () => {
  const { passwordResetAction, state } = actions
  state.resendBlocked = false

  const wrong = await passwordResetAction(
    {
      outcome: "sent",
      context: { flow: "signin", step: "verify", email: EMAIL, next: "/app" },
    },
    form({ intent: "confirm", email: EMAIL, next: "/app", otp: "000000" })
  )
  assert.equal(wrong.outcome, "invalid")
  assert.equal(wrong.retryAt, undefined)
})
