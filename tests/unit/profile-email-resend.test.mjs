import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

async function loadAction() {
  const fixture = `export const state = { customer: { email: "person@example.test", emailVerifiedAt: null }, failure: null, sends: [], revalidated: [] };`
  const result = await build({
    stdin: {
      contents:
        'export { resendHomeProfileEmailAction } from "./app/home/(authed)/profile/actions.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "profile-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|next\/|@\/lib\/)/ },
            ({ path }) => ({ path, namespace: "fixture" })
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            const modules = {
              "fixture-state": fixture,
              "next/cache":
                'import {state} from "fixture-state"; export function revalidatePath(path) {state.revalidated.push(path)}',
              "next/server": "export function after() {}",
              "@/lib/rewards/issue-birthday":
                "export function triggerBirthdayIssuanceForCustomer() {}",
              "@/lib/customer/consent":
                "export function isMarketingChannel() {} export function updateCustomerMarketingConsent() {}",
              "@/lib/customer/identity":
                'import {state} from "fixture-state"; export async function getCurrentCustomer() {return state.customer}',
              "@/lib/customer/profile":
                "export function clearCustomerEmail() {} export function markCustomerEmailVerified() {} export function updateCustomerProfile() {}",
              "@/lib/customer/profile-fields":
                "export function validateProfileFields() {}",
              "@/lib/customer/session":
                "export function clearPendingEmailVerification() {}",
              "@/lib/security/rate-limit":
                "export class RateLimitError extends Error {}",
              "@/lib/customer/email-verification":
                'import {state} from "fixture-state"; import {RateLimitError} from "@/lib/security/rate-limit"; export function checkCustomerEmailVerification() {} export async function startCustomerEmailVerification(email) {if(state.failure === "cooldown") throw new RateLimitError(); if(state.failure) throw new Error("provider unavailable"); state.sends.push(email)}',
            }
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

test("profile resend returns a wait message on cooldown and acknowledges a successful send", async () => {
  const { state, resendHomeProfileEmailAction: resend } = await loadAction()
  state.failure = "cooldown"
  assert.match((await resend({})).errors.form, /wait a minute/)
  assert.deepEqual(state.sends, [])
  assert.deepEqual(state.revalidated, [])
  state.failure = "provider"
  assert.match((await resend({})).errors.form, /couldn't email/)
  state.failure = null
  assert.match((await resend({})).message, /new code/)
  assert.deepEqual(state.sends, ["person@example.test"])
  assert.deepEqual(state.revalidated, ["/home/profile"])
})

test("profile resend does not send for absent or already verified email", async () => {
  const { state, resendHomeProfileEmailAction: resend } = await loadAction()
  for (const customer of [
    null,
    { email: null },
    { email: "person@example.test", emailVerifiedAt: "2026-09-08" },
  ]) {
    state.customer = customer
    assert.match(
      (await resend({})).errors.form,
      /no email awaiting confirmation/
    )
  }
  assert.deepEqual(state.sends, [])
})
