import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Phone sign-in and join open the live wallet that holds the proven phone,
 * even when that wallet's phone was never marked verified (a legacy row, or
 * an attach that stopped half way). The person has just proven the number, so
 * the wallet's phone is marked verified, with an audit row, by
 * `verify_customer_phone_on_sign_in` (proven in
 * tests/db/customer-phone-sign-in-verifies-holder.test.mjs). Driven through
 * the real identity module with Supabase stubbed (QA BUG-031).
 */
const PHONE = { e164: "+447700900149", country: "GB", last4: "0149" }

function holder(overrides = {}) {
  return {
    id: "holder-1",
    auth_user_id: null,
    email: "holder@example.com",
    email_verified_at: "2026-09-27T10:00:00.000Z",
    full_name: null,
    date_of_birth: null,
    date_of_birth_verified_at: null,
    phone_last4: "0149",
    phone_country: "GB",
    phone_verified_at: null,
    created_at: "2026-09-27T10:00:00.000Z",
    ...overrides,
  }
}

async function loadIdentity() {
  const modules = {
    "fixture-state": `export const state = {
      holder: null,
      rpc: { data: "verified", error: null },
      rpcCalls: [],
      selects: [],
      writes: [],
      logs: [],
    };`,
    "@/lib/observability/logger": `import { state } from "fixture-state";
      export const logger = {
        error(message, context) { state.logs.push(["error", message, context]) },
        warn(message, context) { state.logs.push(["warn", message, context]) },
      }`,
    "server-only": "",
    react: "export function cache(fn) { return fn }",
    "next/server": "export function after() {}",
    "@/lib/customer/email-pii-core":
      "export function customerEmailHmac() {} export function normalizeEmail(email) { return email }",
    "@/lib/customer/phone-pii": `export function customerPhoneHmac(e164) { return "phone-hmac:" + e164 }
      export function customerPhonePii(e164) { return { phoneHmac: "phone-hmac:" + e164, phoneCiphertext: "cipher", phoneLast4: e164.slice(-4) } }
      export function maskedPhoneFromLast4(last4) { return last4 ? "Phone ending " + last4 : null }`,
    "@/lib/customer/reward-invites":
      "export function attachRewardInvitesForCustomer() {}",
    "@/lib/customer/session":
      "export async function resolveCustomerSession() { return null }",
    "@/lib/supabase/server": `import { state } from "fixture-state";
      function builder() {
        const chain = {
          select(columns) { state.selects.push(columns); return chain },
          update(values) { state.writes.push(["update", values]); return chain },
          insert(values) { state.writes.push(["insert", values]); return chain },
          eq() { return chain },
          is() { return chain },
          maybeSingle() { return Promise.resolve({ data: state.holder, error: null }) },
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

const VERIFY_CALL = (surface) => [
  "verify_customer_phone_on_sign_in",
  {
    p_customer_id: "holder-1",
    p_phone_hmac: "phone-hmac:+447700900149",
    p_surface: surface,
  },
]

test("Given a live wallet holds the phone unverified When phone sign-in proves it Then that wallet opens and its phone is marked verified", async () => {
  const { findCustomerByVerifiedPhone, state } = await loadIdentity()
  state.holder = holder()

  const customer = await findCustomerByVerifiedPhone(PHONE)

  assert.equal(customer?.id, "holder-1")
  assert.deepEqual(state.rpcCalls, [VERIFY_CALL("home_login")])
  assert.match(state.selects[0], /\bphone_verified_at\b/)
  // The RPC writes the timestamp and its audit row; nothing else is written,
  // and the plaintext phone is never sent.
  assert.deepEqual(state.writes, [])
  assert.equal(Object.values(state.rpcCalls[0][1]).includes(PHONE.e164), false)
  assert.deepEqual(state.logs, [])
})

test("Given a live wallet holds the phone unverified When join proves it Then the existing wallet is used and verified from the join surface", async () => {
  const { getOrCreateCustomerByVerifiedPhone, state } = await loadIdentity()
  state.holder = holder()

  const result = await getOrCreateCustomerByVerifiedPhone(PHONE)

  assert.equal(result.created, false)
  assert.equal(result.customer.id, "holder-1")
  assert.deepEqual(state.rpcCalls, [VERIFY_CALL("join")])
  assert.deepEqual(state.writes, [])
})

test("Given the holder's phone is already verified When phone sign-in proves it Then nothing is written", async () => {
  const { findCustomerByVerifiedPhone, state } = await loadIdentity()
  state.holder = holder({ phone_verified_at: "2026-09-27T10:00:00.000Z" })

  assert.equal((await findCustomerByVerifiedPhone(PHONE))?.id, "holder-1")
  assert.deepEqual(state.rpcCalls, [])
})

test("Given an erased row still holds the phone unverified When phone sign-in proves it Then no wallet is found and nothing is written", async () => {
  const { findCustomerByVerifiedPhone, state } = await loadIdentity()
  state.holder = holder({
    email: "erased+0f1e2d3c4b5a69788796a5b4c3d2e1f0@privacy.invalid",
    email_verified_at: null,
  })

  assert.equal(await findCustomerByVerifiedPhone(PHONE), null)
  assert.deepEqual(state.rpcCalls, [])
})

test("Given the wallet was erased or lost the phone meanwhile When it is verified Then no wallet is opened", async () => {
  for (const status of ["wallet_unavailable", "phone_changed"]) {
    const { findCustomerByVerifiedPhone, state } = await loadIdentity()
    state.holder = holder()
    state.rpc = { data: status, error: null }

    assert.equal(await findCustomerByVerifiedPhone(PHONE), null)
    assert.deepEqual(state.rpcCalls, [VERIFY_CALL("home_login")])
  }
})

test("Given the verify step fails or is not deployed yet When phone sign-in proves the phone Then the wallet still opens and the failure is logged without contact data", async () => {
  for (const rpc of [
    { data: null, error: { code: "PGRST202", message: "function not found" } },
    { data: "merged", error: null },
  ]) {
    const { findCustomerByVerifiedPhone, state } = await loadIdentity()
    state.holder = holder()
    state.rpc = rpc

    assert.equal((await findCustomerByVerifiedPhone(PHONE))?.id, "holder-1")
    assert.equal(state.logs.length, 1)
    const [level, message, context] = state.logs[0]
    assert.equal(level, "error")
    assert.equal(message, "customer_phone_sign_in_verify_failed")
    assert.equal(JSON.stringify(context).includes("0149"), false)
    assert.equal(JSON.stringify(context).includes("holder@example.com"), false)
  }
})
