import assert from "node:assert/strict"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * The join loader's reading of a pending email challenge, with the request,
 * identity and join-context boundaries stubbed. The rollout mode, the
 * newest-challenge rule and the email masking are the real ones.
 *
 * A failed send keeps its challenge (the email may still arrive late), so a
 * refresh must show the code step as delayed, never as a code just sent. A
 * refused (`held`) send must still read exactly like a sent one (D8).
 */
const REAL = [
  "@/lib/customer/email-auth-mode",
  "@/lib/customer/email-pii-core",
  "@/lib/customer/email-sign-in-core",
  "@/lib/customer/pending-cookie-crypto",
  "@/lib/customer/otp-channel-core",
  "@/lib/customer/phone-code-email-fallback",
  "@/lib/observability/request-id",
  "@/lib/navigation/customer-join-intent",
]

const STUBS = {
  "fixture-state": `export const state = { pending: null, handoff: null, phone: null, opened: false };`,
  "@/lib/customer/email-fallback": `import { state } from "fixture-state";
    export async function emailFallbackOpenedFor(purpose) { return purpose === "join" && state.opened }`,
  "server-only": "",
  "next/headers": "export async function headers() { return new Headers() }",
  "@/lib/customer/email-sign-in": `import { state } from "fixture-state";
    export async function getPendingEmailSignIn() { return state.pending }
    export async function readVerifiedEmailHandoff() { return state.handoff }`,
  "@/lib/customer/identity":
    "export async function getCurrentCustomer() { return null }",
  "@/lib/customer/join": `export async function getMerchantJoinContext() {
      return {
        available: true,
        merchant: { id: "merchant-1", business_name: "Old Crown" },
        loyaltyCard: { card_name: "Loyalty card", stamps_required: 5 },
      }
    }
    export async function getMembershipForCustomer() { return null }`,
  "@/lib/customer/phone-verification-state":
    "export async function customerHasVerifiedPhone() { return true }",
  "@/lib/customer/session": `import { state } from "fixture-state";
    export async function getPendingPhoneVerification() { return state.phone }`,
  "@/lib/customer/stamp":
    "export async function getMerchantStampLocationRequirement() { return null }",
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
}

async function loadJoinLoader() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export * from "./lib/customer/experience/load-join.ts"; export { state } from "fixture-state";',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "load-join-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            REAL.includes(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : undefined
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
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
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function pendingChallenge(delivery) {
  return {
    version: 1,
    purpose: "join",
    email: "guest@example.com",
    emailHmac: "a".repeat(64),
    challengeId: "challenge-1",
    codeHmac: "b".repeat(64),
    delivery,
    issuedAt: 1_000,
    expiresAt: 1_600,
    resendAvailableAt: 1_060,
  }
}

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
})

test("Given a join challenge whose send failed When the join page loads Then the code step is marked delayed", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { loadJoinExperienceContext, state } = await loadJoinLoader()
  state.pending = pendingChallenge("fail")

  const context = await loadJoinExperienceContext("old-crown", {})

  assert.deepEqual(context.pendingEmail, {
    maskedEmail: "g***@example.com",
    resendAvailableAt: 1_060,
    deliveryDelayed: true,
  })
})

test("Given a sent or a refused send When the join page loads Then both read as a code on its way", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { loadJoinExperienceContext, state } = await loadJoinLoader()
  const loaded = []
  for (const delivery of ["sent", "held"]) {
    state.pending = pendingChallenge(delivery)
    loaded.push((await loadJoinExperienceContext("old-crown", {})).pendingEmail)
  }

  assert.deepEqual(loaded[0], {
    maskedEmail: "g***@example.com",
    resendAvailableAt: 1_060,
  })
  // A refused send is indistinguishable from a sent one (D8).
  assert.deepEqual(loaded[1], loaded[0])
})

function phoneCode(ageSeconds) {
  return {
    purpose: "join",
    phone: "+447700900123",
    channel: "sms",
    issuedAt: Math.floor(Date.now() / 1_000) - ageSeconds,
  }
}

test("Given step=email When no phone code, failed send or email is under way Then the server keeps the phone step", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { loadJoinExperienceContext } = await loadJoinLoader()

  const context = await loadJoinExperienceContext("old-crown", {
    step: "email",
  })

  assert.equal(context.emailFallbackOpen, false)
  assert.equal(context.pendingOtp, false)
})

test("Given step=email When the latest phone code is under 30 seconds old Then its code step shows instead, with the wait left", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { loadJoinExperienceContext, state } = await loadJoinLoader()
  state.phone = phoneCode(5)

  const context = await loadJoinExperienceContext("old-crown", {
    step: "email",
  })

  assert.equal(context.pendingOtp, true)
  assert.equal(context.pendingPhoneSentAt, state.phone.issuedAt)
  assert.ok(context.pendingPhoneEmailFallbackInSeconds >= 24)
  assert.ok(context.pendingPhoneEmailFallbackInSeconds <= 26)
  assert.equal(context.emailFallbackOpen, undefined)
})

test("Given step=email When the phone code is 30 seconds old, a send failed, or email is under way Then the email form opens", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { loadJoinExperienceContext, state } = await loadJoinLoader()

  state.phone = phoneCode(31)
  const waited = await loadJoinExperienceContext("old-crown", { step: "email" })
  assert.equal(waited.emailFallbackOpen, true)
  assert.equal(waited.pendingOtp, false)
  // Its phone link returns to that code.
  assert.equal(waited.phoneCodePending, true)

  state.phone = null
  state.opened = true
  const failed = await loadJoinExperienceContext("old-crown", { step: "email" })
  assert.equal(failed.emailFallbackOpen, true)
  assert.equal(failed.phoneCodePending, false)

  state.opened = false
  state.pending = pendingChallenge("sent")
  const underWay = await loadJoinExperienceContext("old-crown", {
    step: "email",
  })
  assert.equal(underWay.emailFallbackOpen, true)
  // An explicit contact step: the email form, not the code step.
  assert.equal(underWay.pendingEmail, undefined)
})

test("Given email sign-in is off When step=email is asked for Then the email fallback never opens", async () => {
  const { loadJoinExperienceContext, state } = await loadJoinLoader()
  state.phone = phoneCode(5)
  state.pending = pendingChallenge("sent")

  const context = await loadJoinExperienceContext("old-crown", {
    step: "email",
  })

  assert.equal(context.emailFallbackOpen, undefined)
  assert.equal(context.pendingOtp, true)
})

test("Given the email fallback's send failed When a phone code is still pending Then the page returns to the phone code, not the delayed email", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { loadJoinExperienceContext, state } = await loadJoinLoader()
  state.phone = phoneCode(40)
  // The email challenge is newer, but its code never reached the customer.
  state.pending = {
    ...pendingChallenge("fail"),
    issuedAt: Math.floor(Date.now() / 1_000),
  }

  const context = await loadJoinExperienceContext("old-crown", {})

  assert.equal(context.pendingOtp, true)
  assert.equal(context.pendingEmail, undefined)
  assert.equal(context.pendingPhoneEmailFallbackInSeconds, 0)

  // A code on its way is the newest challenge and wins as before.
  state.pending = {
    ...pendingChallenge("sent"),
    issuedAt: Math.floor(Date.now() / 1_000),
  }
  const sent = await loadJoinExperienceContext("old-crown", {})
  assert.equal(sent.pendingOtp, false)
  assert.equal(sent.pendingEmail.maskedEmail, "g***@example.com")
  assert.equal(sent.phoneCodePending, true)
})
