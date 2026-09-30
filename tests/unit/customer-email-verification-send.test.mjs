import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * `startCustomerEmailVerification` writes the pending-code cookie before it
 * asks Resend to deliver the code. /home opens the email prompt on its code
 * step whenever that cookie matches the saved address, so a failed delivery
 * must not leave it behind. Cookie storage, admission and the provider are
 * stubs; the real module orders the calls.
 */
async function loadVerification() {
  const modules = {
    "fixture-state": `export const state = {
      calls: [],
      pending: null,
      sendFailure: null,
      admissionFailure: false,
    };`,
    "server-only": "",
    "@/lib/customer/email-otp-cooldown": `import { state } from "fixture-state"; import { RateLimitError } from "@/lib/security/rate-limit";
      export async function enforceCustomerEmailOtpAdmission() {
        state.calls.push("admit")
        if (state.admissionFailure) throw new RateLimitError()
      }`,
    "@/lib/notifications/resend": `import { state } from "fixture-state";
      export async function sendEmailOtp() {
        state.calls.push("send")
        if (state.sendFailure) throw new Error("provider detail")
      }`,
    "@/lib/customer/session": `import { state } from "fixture-state";
      export async function getCustomerSession() { return { customerId: "customer-a" } }
      export async function getPendingEmailVerification() { return state.pending }
      export async function setPendingEmailVerification(input) {
        state.calls.push("set"); state.pending = input; return input
      }
      export async function clearPendingEmailVerification() {
        state.calls.push("clear"); state.pending = null
      }`,
    "@/lib/security/rate-limit":
      "export class RateLimitError extends Error {} export async function enforceRateLimit() {}",
    "@/lib/security/customer-session-secret":
      'export function requiredCustomerSessionSecret() { return "unit-test-secret" }',
  }
  const result = await build({
    stdin: {
      contents:
        'export * from "./lib/customer/email-verification.ts"; export { state } from "fixture-state"; export { RateLimitError } from "@/lib/security/rate-limit";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "email-verification-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|@\/lib\/)/ },
            ({ path }) =>
              // The real address normaliser (pure), as stored addresses use.
              path === "@/lib/customer/email-pii-core"
                ? { path: `${process.cwd()}/lib/customer/email-pii-core.ts` }
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

test("Given the provider delivers When a code is sent Then the pending code stays for the code step", async () => {
  const verification = await loadVerification()

  const result = await verification.startCustomerEmailVerification(
    " Guest@Example.test "
  )

  assert.deepEqual(result, { status: "sent" })
  assert.deepEqual(verification.state.calls, ["admit", "set", "send"])
  assert.equal(verification.state.pending.email, "guest@example.test")
  assert.equal(verification.state.pending.customerId, "customer-a")
})

test("Given the provider fails When a code is sent Then the pending code is cleared and the failure still reaches the caller", async () => {
  const verification = await loadVerification()
  verification.state.sendFailure = true

  await assert.rejects(
    verification.startCustomerEmailVerification("guest@example.test"),
    /provider detail/
  )

  assert.deepEqual(verification.state.calls, ["admit", "set", "send", "clear"])
  assert.equal(verification.state.pending, null)
})

test("Given the cooldown refuses a re-send When a code is requested Then the earlier pending code is left untouched", async () => {
  const verification = await loadVerification()
  const earlier = {
    email: "guest@example.test",
    codeHmac: "earlier",
    customerId: "customer-a",
  }
  verification.state.pending = earlier
  verification.state.admissionFailure = true

  await assert.rejects(
    verification.startCustomerEmailVerification("guest@example.test"),
    verification.RateLimitError
  )

  assert.deepEqual(verification.state.calls, ["admit"])
  assert.equal(verification.state.pending, earlier)
})
