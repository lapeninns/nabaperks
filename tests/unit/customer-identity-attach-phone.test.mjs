import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Adding a verified phone to an email-only wallet (D4: attach, never merge),
 * driven through the real identity module with Supabase stubbed. The attach
 * itself is one database transaction (`attach_verified_customer_phone`, proven
 * in tests/db/customer-phone-attach-atomic.test.mjs); this proves what the app
 * sends it and how each outcome is reported (QA BUG-002, BUG-013).
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
      loaded: null,
      rpc: { data: "attached", error: null },
      rpcCalls: [],
      queries: [],
      writes: [],
      afterCalls: [],
      logs: [],
    };`,
    "@/lib/observability/logger":
      'import { state } from "fixture-state"; export const logger = { error(message, context) { state.logs.push([message, context]) } }',
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
        const chain = {
          select(columns) { ops.push(["select"]); return chain },
          update(values) { state.writes.push(["update", values]); return chain },
          insert(values) { state.writes.push(["insert", values]); return chain },
          eq(column, value) { ops.push(["eq", column, value]); return chain },
          is(column, value) { ops.push(["is", column, value]); return chain },
          maybeSingle() {
            state.queries.push(ops)
            const byId = ops.some(([op, column]) => op === "eq" && column === "id")
            return Promise.resolve({ data: byId ? state.loaded : state.holder, error: null })
          },
        }
        return chain
      }
      export function createSupabaseServiceRoleClient() {
        return {
          rpc(name, args) { state.rpcCalls.push([name, args]); return Promise.resolve(state.rpc) },
          from(table) {
            if (table !== "customers") throw new Error(table)
            return builder()
          },
        }
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

const ATTACH = { customerId: "customer-1", phone: PHONE, surface: "profile" }
const ATTACHED_ROW = row({ phone_last4: "0123", phone_country: "GB" })

test("Given an unused phone When it is attached Then one RPC writes it, the wallet is reloaded and invites are attached", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.loaded = ATTACHED_ROW

  const result = await attachVerifiedPhoneToCustomer(ATTACH)

  assert.equal(result.status, "attached")
  assert.equal(result.customer.phoneLast4, "0123")
  assert.deepEqual(state.rpcCalls, [
    [
      "attach_verified_customer_phone",
      {
        p_customer_id: "customer-1",
        p_phone_hmac: "phone-hmac:+447700900123",
        p_phone_ciphertext: "cipher",
        p_phone_last4: "0123",
        p_phone_country: "GB",
        p_surface: "profile",
      },
    ],
  ])
  // No write of its own: the phone, its verified timestamp and the audit row
  // are the RPC's, in one transaction. Never plaintext.
  assert.deepEqual(state.writes, [])
  assert.equal(Object.values(state.rpcCalls[0][1]).includes(PHONE.e164), false)
  assert.deepEqual(state.queries, [[["select"], ["eq", "id", "customer-1"]]])
  assert.equal(state.afterCalls.length, 1)
  state.afterCalls[0]()
  assert.equal(state.attached, "customer-1")
})

test("Given the RPC refuses When a phone is attached Then each refusal is reported as it is and nothing else happens", async () => {
  for (const status of [
    "contact_conflict",
    "already_has_phone",
    "wallet_unavailable",
  ]) {
    const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
    state.rpc = { data: status, error: null }

    assert.deepEqual(await attachVerifiedPhoneToCustomer(ATTACH), { status })
    assert.deepEqual(state.queries, [])
    assert.deepEqual(state.afterCalls, [])
    assert.deepEqual(state.logs, [])
  }
})

test("Given the audit row cannot be written When a phone is attached Then the add is refused and logged without contact data", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.rpc = { data: "audit_failed", error: null }

  assert.deepEqual(await attachVerifiedPhoneToCustomer(ATTACH), {
    status: "audit_failed",
  })
  assert.deepEqual(state.logs, [
    ["customer_phone_audit_failed", { action: "customer_phone_attached" }],
  ])
  assert.deepEqual(state.afterCalls, [])
})

test("Given the RPC fails or answers something unknown When a phone is attached Then the call throws instead of reporting an outcome", async () => {
  for (const [rpc, message] of [
    [
      { data: null, error: { code: "57014", message: "statement timeout" } },
      /Unable to add customer phone: statement timeout/,
    ],
    [{ data: "merged", error: null }, /unexpected outcome/],
  ]) {
    const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
    state.rpc = rpc
    await assert.rejects(attachVerifiedPhoneToCustomer(ATTACH), message)
    assert.deepEqual(state.afterCalls, [])
  }

  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.loaded = null
  await assert.rejects(
    attachVerifiedPhoneToCustomer(ATTACH),
    /Unable to load customer after adding a phone/
  )
  assert.deepEqual(state.afterCalls, [])
})

test("Given phone sign-in When the phone is held by an erased wallet Then no wallet is found (QA BUG-002)", async () => {
  const { findCustomerByVerifiedPhone, state } = await loadIdentity()
  state.holder = row({
    email: "erased+0f1e2d3c4b5a69788796a5b4c3d2e1f0@privacy.invalid",
    email_verified_at: null,
    phone_last4: "0123",
  })
  assert.equal(await findCustomerByVerifiedPhone(PHONE), null)

  const live = await loadIdentity()
  live.state.holder = row({ phone_last4: "0123" })
  assert.equal(
    (await live.findCustomerByVerifiedPhone(PHONE))?.id,
    "customer-1"
  )

  // A phone-only wallet has no email at all and is live.
  const phoneOnly = await loadIdentity()
  phoneOnly.state.holder = row({ email: null, email_verified_at: null })
  assert.equal(
    (await phoneOnly.findCustomerByVerifiedPhone(PHONE))?.id,
    "customer-1"
  )
})
