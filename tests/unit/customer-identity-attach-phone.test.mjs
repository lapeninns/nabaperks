import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Adding a verified phone to an email-only wallet (D4: attach, never merge),
 * driven through the real identity module with Supabase stubbed.
 */
const PHONE = { e164: "+447700900123", country: "GB", last4: "0123" }

function row(overrides = {}) {
  return {
    id: "customer-1",
    auth_user_id: null,
    email: "guest@example.com",
    email_verified_at: "2026-09-27T10:00:00.000Z",
    full_name: null,
    date_of_birth: null,
    date_of_birth_verified_at: null,
    phone_last4: null,
    phone_country: null,
    created_at: "2026-09-27T10:00:00.000Z",
    ...overrides,
  }
}

async function loadIdentity() {
  const modules = {
    "fixture-state": `export const state = {
      holder: null,
      updateResult: null,
      queries: [],
      updates: [],
      afterCalls: [],
    };`,
    "server-only": "",
    react: "export function cache(fn) { return fn }",
    "next/server":
      'import { state } from "fixture-state"; export function after(fn) { state.afterCalls.push(fn) }',
    "@/lib/customer/email-pii-core":
      "export function customerEmailHmac() {} export function normalizeEmail(email) { return email }",
    "@/lib/customer/phone-pii": `export function customerPhoneHmac(e164) { return "phone-hmac:" + e164 }
      export function customerPhonePii(e164) { return { phoneHmac: "phone-hmac:" + e164, phoneCiphertext: "cipher", phoneLast4: e164.slice(-4) } }
      export function maskedPhoneFromLast4(last4) { return last4 ? "Phone ending " + last4 : null }`,
    "@/lib/customer/reward-invites":
      'import { state } from "fixture-state"; export function attachRewardInvitesForCustomer(id) { state.attached = id }',
    "@/lib/customer/session":
      "export async function resolveCustomerSession() { return null }",
    "@/lib/supabase/server": `import { state } from "fixture-state";
      function builder() {
        const ops = []
        let updating = false
        const chain = {
          select(columns) { ops.push(["select"]); return chain },
          update(values) { updating = true; state.updates.push(values); return chain },
          eq(column, value) { ops.push(["eq", column, value]); return chain },
          is(column, value) { ops.push(["is", column, value]); return chain },
          maybeSingle() {
            state.queries.push(ops)
            return Promise.resolve(
              updating ? state.updateResult : { data: state.holder, error: null }
            )
          },
        }
        return chain
      }
      export function createSupabaseServiceRoleClient() {
        return { from(table) { if (table !== "customers") throw new Error(table); return builder() } }
      }`,
  }
  const result = await build({
    stdin: {
      contents:
        'export * from "./lib/customer/identity.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "identity-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|react$|next\/|@\/lib\/)/ },
            ({ path }) => ({ path, namespace: "fixture" })
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

test("Given an unused phone When it is attached Then only a phoneless wallet row is updated and invites are attached", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.updateResult = {
    data: row({ phone_last4: "0123", phone_country: "GB" }),
    error: null,
  }

  const result = await attachVerifiedPhoneToCustomer({
    customerId: "customer-1",
    phone: PHONE,
  })

  assert.equal(result.status, "attached")
  assert.equal(result.customer.phoneLast4, "0123")
  const [update] = state.updates
  assert.equal(update.phone_hmac, "phone-hmac:+447700900123")
  assert.equal(update.phone_ciphertext, "cipher")
  assert.equal(update.phone_last4, "0123")
  assert.equal(update.phone_country, "GB")
  assert.match(update.phone_verified_at, /^\d{4}-\d{2}-\d{2}T/)
  // Never plaintext at rest.
  assert.equal("phone" in update, false)
  assert.equal(Object.values(update).includes(PHONE.e164), false)
  const [lookup, guarded] = state.queries
  assert.deepEqual(lookup, [
    ["select"],
    ["eq", "phone_hmac", "phone-hmac:+447700900123"],
  ])
  assert.deepEqual(guarded, [
    ["eq", "id", "customer-1"],
    ["is", "phone_hmac", null],
    ["select"],
  ])
  assert.equal(state.afterCalls.length, 1)
  state.afterCalls[0]()
  assert.equal(state.attached, "customer-1")
})

test("Given another wallet holds the phone When it is attached Then it is a conflict and nothing is written", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.holder = row({ id: "someone-else", phone_last4: "0123" })

  const result = await attachVerifiedPhoneToCustomer({
    customerId: "customer-1",
    phone: PHONE,
  })

  assert.deepEqual(result, { status: "contact_conflict" })
  assert.deepEqual(state.updates, [])
  assert.deepEqual(state.afterCalls, [])
})

test("Given the phone is already this wallet's When it is attached Then nothing changes", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.holder = row({ phone_last4: "0123" })

  assert.deepEqual(
    await attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
    }),
    { status: "already_has_phone" }
  )
  assert.deepEqual(state.updates, [])
})

test("Given a race When the unique phone index or the phoneless guard refuses Then the answer is a conflict or no change", async () => {
  const raced = await loadIdentity()
  raced.state.updateResult = {
    data: null,
    error: { code: "23505", message: "duplicate key value" },
  }
  assert.deepEqual(
    await raced.attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
    }),
    { status: "contact_conflict" }
  )
  assert.deepEqual(raced.state.afterCalls, [])

  const guarded = await loadIdentity()
  guarded.state.updateResult = { data: null, error: null }
  assert.deepEqual(
    await guarded.attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
    }),
    { status: "already_has_phone" }
  )

  const broken = await loadIdentity()
  broken.state.updateResult = {
    data: null,
    error: { code: "42501", message: "permission denied" },
  }
  await assert.rejects(
    broken.attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
    }),
    /Unable to add customer phone/
  )
})
