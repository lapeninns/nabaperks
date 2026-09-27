import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Email identity lookups (D3) and the one place an email-only wallet is
 * created (D2), driven through the real identity module with Supabase stubbed.
 */
const ROW = {
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
}

async function loadIdentity() {
  const modules = {
    "fixture-state": `export const state = {
      selectResults: [],
      insertResult: null,
      queries: [],
      inserts: [],
      afterCalls: [],
    };`,
    "server-only": "",
    react: "export function cache(fn) { return fn }",
    "next/server":
      'import { state } from "fixture-state"; export function after(fn) { state.afterCalls.push(fn) }',
    "@/lib/customer/email-pii-core":
      'export function customerEmailHmac(email) { return "hmac:" + email.trim().toLowerCase() } export function normalizeEmail(email) { return email.trim().toLowerCase() }',
    "@/lib/customer/phone-pii":
      "export function customerPhoneHmac() {} export function customerPhonePii() {} export function maskedPhoneFromLast4() { return null }",
    "@/lib/customer/reward-invites":
      'import { state } from "fixture-state"; export function attachRewardInvitesForCustomer(id) { state.attached = id }',
    "@/lib/customer/session":
      "export async function resolveCustomerSession() { return null }",
    "@/lib/supabase/server": `import { state } from "fixture-state";
      function builder() {
        const ops = []
        const chain = {
          select(columns) { ops.push(["select", columns]); return chain },
          insert(values) { ops.push(["insert", values]); state.inserts.push(values); return chain },
          eq(column, value) { ops.push(["eq", column, value]); return chain },
          not(column, operator, value) { ops.push(["not", column, operator, value]); return chain },
          maybeSingle() { state.queries.push(ops); return Promise.resolve(state.selectResults.shift() ?? { data: null, error: null }) },
          single() { return Promise.resolve(state.insertResult) },
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

test("Given an email When a wallet is looked up Then only a verified address on the email HMAC matches", async () => {
  const { findCustomerByVerifiedEmail, state } = await loadIdentity()
  state.selectResults.push({ data: ROW, error: null })

  const customer = await findCustomerByVerifiedEmail(" Guest@Example.com ")

  assert.equal(customer.id, "customer-1")
  assert.equal(customer.phoneLast4, null)
  const [ops] = state.queries
  assert.deepEqual(
    ops.filter(([op]) => op !== "select"),
    [
      ["eq", "email_hmac", "hmac:guest@example.com"],
      ["not", "email_verified_at", "is", null],
    ]
  )
  assert.doesNotMatch(JSON.stringify(ops), /"email",/)
})

test("Given no verified wallet holds the email When looked up Then nothing is returned", async () => {
  const { findCustomerByVerifiedEmail, state } = await loadIdentity()
  assert.equal(await findCustomerByVerifiedEmail("guest@example.com"), null)
  assert.equal(state.queries.length, 1)
})

test("Given a new verified email When a wallet is created Then it holds only the verified email and attaches invites", async () => {
  const { createCustomerByVerifiedEmail, state } = await loadIdentity()
  state.insertResult = { data: ROW, error: null }

  const result = await createCustomerByVerifiedEmail("Guest@Example.com")

  assert.equal(result.created, true)
  assert.equal(result.customer.id, "customer-1")
  const [insert] = state.inserts
  assert.equal(insert.auth_user_id, null)
  assert.equal(insert.email, "guest@example.com")
  assert.equal(insert.email_hmac, "hmac:guest@example.com")
  assert.ok(Date.parse(insert.email_verified_at))
  assert.equal(
    Object.keys(insert).some((key) => key.startsWith("phone")),
    false
  )
  assert.equal(state.afterCalls.length, 1)
  state.afterCalls[0]()
  assert.equal(state.attached, "customer-1")
})

test("Given a concurrent creation wins When the insert hits the unique index Then the winning wallet is returned", async () => {
  const { createCustomerByVerifiedEmail, state } = await loadIdentity()
  state.insertResult = {
    data: null,
    error: { code: "23505", message: "duplicate key value" },
  }
  state.selectResults.push({ data: { ...ROW, id: "customer-2" }, error: null })

  const result = await createCustomerByVerifiedEmail("guest@example.com")

  assert.deepEqual(
    { id: result.customer.id, created: result.created },
    { id: "customer-2", created: false }
  )
  assert.equal(state.afterCalls.length, 0)
})

test("Given any other insert failure When a wallet is created Then it throws", async () => {
  const { createCustomerByVerifiedEmail, state } = await loadIdentity()
  state.insertResult = {
    data: null,
    error: { code: "23514", message: "check" },
  }
  await assert.rejects(
    createCustomerByVerifiedEmail("guest@example.com"),
    /Unable to create customer/
  )
})
