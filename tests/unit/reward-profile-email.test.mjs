import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

async function loadAction() {
  const modules = {
    "fixture-state": `export const state = { customer: null, saves: [], sends: [], events: [], revalidated: [] };`,
    "next/cache":
      'import { state } from "fixture-state"; export function revalidatePath(path) { state.revalidated.push(path) }',
    "@/lib/customer/identity":
      'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
    "@/lib/customer/profile":
      'import { state } from "fixture-state"; export function clearCustomerEmail() {} export function markCustomerEmailVerified() {} export async function updateCustomerProfile(input) { state.saves.push(input); return { email: input.email, emailVerificationRequired: !state.customer?.emailVerifiedAt }; }',
    "@/lib/customer/session":
      "export function clearPendingEmailVerification() {}",
    "@/lib/customer/contact-events":
      'import { state } from "fixture-state"; export function recordCustomerContactEvent(event) { state.events.push(event) }',
    "@/lib/customer/email-confirmation":
      "export function confirmCustomerEmailCode() {} export function emailConfirmationErrors() { return null }",
    "@/lib/customer/email-verification":
      'import { state } from "fixture-state"; export function checkCustomerEmailVerification() {} export async function startCustomerEmailVerification(email) { state.sends.push(email) }',
  }
  const result = await build({
    stdin: {
      contents:
        'export { saveProfileForRedeemAction } from "./app/reward/[rewardId]/actions.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "profile-io-boundaries",
        setup(build) {
          build.onResolve({ filter: /.*/ }, ({ path }) =>
            path in modules ? { path, namespace: "fixture" } : undefined
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents: modules[path],
          }))
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function details(email) {
  const form = new FormData()
  form.set("rewardId", "test-reward")
  form.set("fullName", "Adult Customer")
  form.set("dateOfBirth", "1990-01-01")
  if (email !== undefined) form.set("email", email)
  return form
}

for (const email of [undefined, "", "   "]) {
  test(`Given missing email ${JSON.stringify(email)} When reward details are saved Then validation prevents profile and provider writes`, async () => {
    const { state, saveProfileForRedeemAction: save } = await loadAction()
    const result = await save({}, details(email))
    assert.ok(result.errors?.email)
    assert.deepEqual(state.saves, [])
    assert.deepEqual(state.sends, [])
    assert.deepEqual(state.revalidated, [])
  })
}

test("Given a verified locked email omitted from the form When reward details are saved Then the verified address is retained without another code", async () => {
  const { state, saveProfileForRedeemAction: save } = await loadAction()
  state.customer = {
    email: "adult@example.test",
    emailVerifiedAt: "2026-09-01",
  }
  const result = await save({}, details())
  assert.equal(result.errors, undefined)
  assert.equal(state.saves[0].email, "adult@example.test")
  assert.deepEqual(state.sends, [])
})

test("Given a new email When reward details are saved Then the address awaits the existing email-code flow", async () => {
  const { state, saveProfileForRedeemAction: save } = await loadAction()
  const result = await save({}, details("adult@example.test"))
  assert.equal(result.errors, undefined)
  assert.equal(state.saves[0].email, "adult@example.test")
  // The address change is audited as a reward-gate submission (QA BUG-023).
  assert.equal(state.saves[0].surface, "reward_gate")
  assert.deepEqual(state.sends, ["adult@example.test"])
  assert.deepEqual(state.events, [
    {
      eventName: "customer_email_verification_started",
      customerId: null,
      metadata: { method: "email", surface: "reward_gate" },
    },
  ])
})

function detailsStep() {
  const form = details()
  form.set("part", "details")
  return form
}

test("Given the details step When name and date of birth are saved alone Then no email is required and no code is sent", async () => {
  const { state, saveProfileForRedeemAction: save } = await loadAction()
  const result = await save({}, detailsStep())
  assert.equal(result.errors, undefined)
  assert.equal(state.saves.length, 1)
  assert.equal(state.saves[0].fullName, "Adult Customer")
  assert.equal(state.saves[0].email, null)
  assert.deepEqual(state.sends, [])
  assert.deepEqual(state.revalidated, ["/reward/test-reward"])
})

test("Given an unconfirmed address on file When the details step is saved Then the address is kept and the email step, not this save, sends the code", async () => {
  const { state, saveProfileForRedeemAction: save } = await loadAction()
  state.customer = { email: "adult@example.test", emailVerifiedAt: null }
  const form = detailsStep()
  // A details-only save ignores any posted address.
  form.set("email", "other@example.test")
  const result = await save({}, form)
  assert.equal(result.errors, undefined)
  assert.equal(state.saves[0].email, "adult@example.test")
  assert.deepEqual(state.sends, [])
  assert.deepEqual(state.events, [])
})
