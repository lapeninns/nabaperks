import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-066 (38c42a1..2c45031). The pending email code lives in a 10-minute
 * cookie. After it lapses, the correct code from the email was refused as
 * "That code didn't match. Check your email and try again.", which can never
 * succeed. A missing pending code is now its own `expired` answer, with copy
 * that points to a new code.
 */

const SECRET = "unit-test-secret"

async function bundle(entry, modules, passthrough = new Set()) {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd() },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "bug-066-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
            ({ path }) =>
              passthrough.has(path)
                ? { path: `${process.cwd()}/${path.slice(2)}.ts` }
                : { path, namespace: "fixture" }
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            assert.ok(path in modules, `Unrecognised boundary: ${path}`)
            return { contents: modules[path] }
          })
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function loadVerification() {
  return bundle(
    'export * from "./lib/customer/email-verification.ts"; export { state } from "fixture-state";',
    {
      "fixture-state": `export const state = { pending: null, cleared: 0, limits: [] };`,
      "server-only": "",
      "@/lib/customer/email-otp-cooldown":
        "export async function enforceCustomerEmailOtpAdmission() {}",
      "@/lib/notifications/resend": "export async function sendEmailOtp() {}",
      "@/lib/customer/session": `import { state } from "fixture-state";
        export async function getCustomerSession() { return { customerId: "customer-a" } }
        export async function getPendingEmailVerification() { return state.pending }
        export async function setPendingEmailVerification(input) { state.pending = input; return input }
        export async function clearPendingEmailVerification() { state.cleared += 1; state.pending = null }`,
      "@/lib/security/rate-limit": `import { state } from "fixture-state";
        export class RateLimitError extends Error {}
        export async function enforceRateLimit(input) { state.limits.push(input.key) }`,
      "@/lib/security/customer-session-secret": `export function requiredCustomerSessionSecret() { return "${SECRET}" }`,
    },
    new Set(["@/lib/customer/email-pii-core"])
  )
}

function loadConfirmation(check) {
  return bundle(
    'export * from "./lib/customer/email-confirmation.ts"; export { state } from "fixture-state";',
    {
      "fixture-state": `export const state = { check: ${JSON.stringify(check)}, marks: 0, events: [] };`,
      "server-only": "",
      "@/lib/customer/email-verification":
        'import { state } from "fixture-state"; export async function checkCustomerEmailVerification() { return state.check }',
      // PR #410's wallet link runs only after a conflict, which these cases
      // never reach; the stub makes an unexpected call visible.
      "@/lib/customer/wallet-link":
        'export async function linkWalletAfterContactVerification() { throw new Error("unexpected wallet link") } export function walletLinkFailureMessage() { return "" }',
      "@/lib/customer/identity":
        'export async function getCurrentCustomer() { return { id: "customer-a" } }',
      "@/lib/customer/profile":
        'import { state } from "fixture-state"; export class CustomerContactLockedError extends Error {} export async function markCustomerEmailVerified() { state.marks += 1; return { status: "verified" } }',
      "@/lib/customer/contact-events":
        'import { state } from "fixture-state"; export function recordCustomerContactEvent(event) { state.events.push(event) }',
    },
    new Set([
      "@/lib/customer/contact-event-core",
      "@/lib/customer/email-auth-mode",
    ])
  )
}

// The deployed app's digest: plain trim + lower case.
function deployedDigest(email, code) {
  return createHmac("sha256", SECRET)
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex")
}

test("Given the pending code has lapsed When a code is checked Then the answer is expired, not rejected", async () => {
  const verification = await loadVerification()

  assert.deepEqual(
    await verification.checkCustomerEmailVerification("123456"),
    { status: "expired" }
  )
  // Nothing was pending, so no guess is counted.
  assert.deepEqual(verification.state.limits, [])
})

test("Given a live pending code When a wrong code is checked Then it is still rejected", async () => {
  const verification = await loadVerification()
  verification.state.pending = {
    email: "guest@example.test",
    codeHmac: deployedDigest("guest@example.test", "123456"),
    customerId: "customer-a",
  }

  assert.deepEqual(
    await verification.checkCustomerEmailVerification("654321"),
    { status: "rejected" }
  )
})

test("Given an expired check When the code is confirmed Then nothing is marked or tracked and the copy asks for a new code", async () => {
  const confirmation = await loadConfirmation({ status: "expired" })

  const result = await confirmation.confirmCustomerEmailCode(
    "123456",
    "profile"
  )

  assert.deepEqual(result, { status: "expired" })
  assert.equal(confirmation.state.marks, 0)
  assert.deepEqual(confirmation.state.events, [])
  assert.deepEqual(confirmation.emailConfirmationErrors(result), {
    otp: "That code has expired. Email me a new code.",
  })
  // A wrong code keeps its own copy.
  assert.deepEqual(
    confirmation.emailConfirmationErrors({ status: "rejected" }),
    { otp: "That code didn't match. Check your email and try again." }
  )
})
