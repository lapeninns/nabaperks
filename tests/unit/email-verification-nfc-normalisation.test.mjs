import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { build } from "esbuild"

import { emailSignInCodeHmac } from "@/lib/customer/email-sign-in-core"

/**
 * Email-code normalisation (QA 38c42a1..2c45031, cluster B consistency note):
 * the pending address and its code digest are normalised with the
 * shared `normalizeEmail` (trim, lower case, Unicode NFC), as stored and
 * verified addresses are, so a composed and a decomposed accent are one
 * address. ASCII addresses digest exactly as the deployed app's cookies do.
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
        name: "email-nfc-boundaries",
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

// The deployed app's digest: plain trim + lower case.
function deployedDigest(email, code) {
  return createHmac("sha256", SECRET)
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex")
}

test("Given a pending cookie written by the deployed app When its ASCII code is checked Then it still verifies", async () => {
  const verification = await loadVerification()
  verification.state.pending = {
    email: "guest@example.test",
    codeHmac: deployedDigest(" Guest@Example.test ", "123456"),
    customerId: "customer-a",
  }

  assert.equal(
    verification.emailCodeHmac(" Guest@Example.test ", "123456"),
    deployedDigest("guest@example.test", "123456")
  )
  assert.deepEqual(
    await verification.checkCustomerEmailVerification("123456"),
    { status: "approved", email: "guest@example.test" }
  )
})

test("Given a decomposed accent When a code is sent and checked Then it is the same address as its composed form", async () => {
  const verification = await loadVerification()
  const decomposed = "Zoe\u0301@example.test"
  const composed = decomposed.normalize("NFC")
  assert.notEqual(composed, decomposed)

  assert.equal(
    verification.emailCodeHmac(decomposed, "123456"),
    verification.emailCodeHmac(composed, "123456")
  )
  await verification.startCustomerEmailVerification(decomposed)
  assert.equal(verification.state.pending.email, composed.toLowerCase())

  // Email sign-in binds its challenge digest to the same normalised address.
  const challenge = {
    secret: "s".repeat(48),
    purpose: "join",
    challengeId: "5b0a3c1e-7a7e-4c43-9c43-7c9f1b0f2a11",
    code: "123456",
  }
  assert.equal(
    emailSignInCodeHmac({ ...challenge, email: decomposed }),
    emailSignInCodeHmac({ ...challenge, email: composed })
  )
  assert.equal(
    emailSignInCodeHmac({ ...challenge, email: " Guest@Example.COM " }),
    emailSignInCodeHmac({ ...challenge, email: "guest@example.com" })
  )
})
