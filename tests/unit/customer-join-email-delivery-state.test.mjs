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
]

const STUBS = {
  "fixture-state": `export const state = { pending: null, handoff: null };`,
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
  "@/lib/customer/session":
    "export async function getPendingPhoneVerification() { return null }",
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
