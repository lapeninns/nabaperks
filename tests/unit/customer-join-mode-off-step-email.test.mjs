import assert from "node:assert/strict"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-018: while email sign-in is off, `step=email` does not exist, so it
 * must answer with the phone step exactly as it does in the first 30 seconds:
 * the pending phone code if there is one. The 30-second email fallback gate is
 * an email rule and must not hide that code once the wait is over.
 *
 * The join loader and the real derivation run together with only the request,
 * cookie, identity and join-context boundaries stubbed; the rollout mode, the
 * fallback timing and the newest-challenge rule are the real ones.
 */
const STUBS = {
  "fixture-state": `export const state = { phone: null, opened: false };`,
  "server-only": "",
  "next/headers": "export async function headers() { return new Headers() }",
  "@/lib/customer/email-fallback": `import { state } from "fixture-state";
    export async function emailFallbackOpenedFor(purpose) { return purpose === "join" && state.opened }`,
  // Mode off never reads these; a read would fail the test.
  "@/lib/customer/email-sign-in": `
    export async function getPendingEmailSignIn() { throw new Error("email read while off") }
    export async function readVerifiedEmailHandoff() { throw new Error("email read while off") }`,
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

async function loadJoin() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents: `export { loadJoinExperienceContext } from "./lib/customer/experience/load-join.ts";
        export { deriveCustomerExperience } from "./lib/customer/experience/derive.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "join-loader-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            specifier in STUBS
              ? { path: specifier, namespace: "fixture" }
              : { path: path.join(root, `${specifier.slice(2)}.ts`) }
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/headers$)/ },
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

function phoneCode(ageSeconds) {
  return {
    purpose: "join",
    phone: "+447400900123",
    channel: "sms",
    issuedAt: Math.floor(Date.now() / 1_000) - ageSeconds,
  }
}

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
})

for (const age of [5, 31, 600]) {
  test(`Given email sign-in is off and a phone code ${age} s old When step=email is opened Then the pending code step shows`, async () => {
    process.env.CUSTOMER_EMAIL_AUTH_MODE = "off"
    const { loadJoinExperienceContext, deriveCustomerExperience, state } =
      await loadJoin()
    state.phone = phoneCode(age)

    const context = await loadJoinExperienceContext("old-crown", {
      qr: "venue-qr",
      step: "email",
    })
    const experience = deriveCustomerExperience({ entry: "join", context })

    assert.equal(context.pendingOtp, true)
    assert.equal(context.emailFallbackOpen, undefined)
    assert.equal(experience.kind, "join_otp")
    assert.equal(experience.contact.method, "phone")
    assert.equal(experience.contact.last4, "0123")
    // No email offer while off, whatever the wait.
    assert.equal(experience.contact.emailFallbackInSeconds, undefined)
  })
}

test("Given email sign-in is off and an old fallback record When step=email is opened Then the pending code step still shows", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "off"
  const { loadJoinExperienceContext, deriveCustomerExperience, state } =
    await loadJoin()
  state.phone = phoneCode(5)
  // Recorded while email was on (a failed send), before the switch to off.
  state.opened = true

  const context = await loadJoinExperienceContext("old-crown", {
    step: "email",
  })

  assert.equal(
    deriveCustomerExperience({ entry: "join", context }).kind,
    "join_otp"
  )
})

test("Given email sign-in is off and no phone code When step=email is opened Then the phone number step shows", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "off"
  const { loadJoinExperienceContext, deriveCustomerExperience, state } =
    await loadJoin()
  state.opened = true

  const context = await loadJoinExperienceContext("old-crown", {
    step: "email",
  })

  assert.equal(context.emailFallbackOpen, false)
  assert.equal(
    deriveCustomerExperience({ entry: "join", context }).kind,
    "join_phone"
  )
})
