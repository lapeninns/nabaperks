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
      updateResults: [],
      order: [],
      queries: [],
      updates: [],
      afterCalls: [],
      audits: [],
      auditError: null,
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
        let updating = false
        const chain = {
          select(columns) { ops.push(["select"]); return chain },
          update(values) { updating = true; state.updates.push(values); state.order.push("update"); return chain },
          eq(column, value) { ops.push(["eq", column, value]); return chain },
          is(column, value) { ops.push(["is", column, value]); return chain },
          maybeSingle() {
            state.queries.push(ops)
            return Promise.resolve(
              updating
                ? (state.updateResults.shift() ?? { data: null, error: null })
                : { data: state.holder, error: null }
            )
          },
        }
        return chain
      }
      export function createSupabaseServiceRoleClient() {
        return {
          from(table) {
            if (table === "audit_logs") {
              return { insert(values) { state.audits.push(values); state.order.push("audit"); return Promise.resolve({ error: state.auditError }) } }
            }
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
            ({ path }) =>
              // The real audit writer, so its row shape is what is asserted.
              path === "@/lib/customer/email-audit"
                ? { path: `${process.cwd()}/lib/customer/email-audit.ts` }
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

const STAGED = { data: { id: "customer-1" }, error: null }
const VERIFIED = {
  data: row({ phone_last4: "0123", phone_country: "GB" }),
  error: null,
}
const RELEASE = {
  phone_hmac: null,
  phone_ciphertext: null,
  phone_last4: null,
  phone_country: null,
}
const THIS_CALLS_UNVERIFIED_PHONE = [
  ["eq", "id", "customer-1"],
  ["eq", "phone_hmac", "phone-hmac:+447700900123"],
  ["is", "phone_verified_at", null],
  ["select"],
]
const ATTACH = { customerId: "customer-1", phone: PHONE, surface: "profile" }

test("Given an unused phone When it is attached Then it is staged, audited, and only then marked verified, and invites are attached", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.updateResults = [STAGED, VERIFIED]

  const result = await attachVerifiedPhoneToCustomer(ATTACH)

  assert.equal(result.status, "attached")
  assert.equal(result.customer.phoneLast4, "0123")
  // The verified timestamp is written only once the audit row exists.
  assert.deepEqual(state.order, ["update", "audit", "update"])
  const [staged, verified] = state.updates
  assert.deepEqual(staged, {
    phone_hmac: "phone-hmac:+447700900123",
    phone_ciphertext: "cipher",
    phone_last4: "0123",
    phone_country: "GB",
  })
  assert.deepEqual(Object.keys(verified), ["phone_verified_at"])
  assert.match(verified.phone_verified_at, /^\d{4}-\d{2}-\d{2}T/)
  // Never plaintext at rest.
  for (const update of state.updates) {
    assert.equal("phone" in update, false)
    assert.equal(Object.values(update).includes(PHONE.e164), false)
  }
  const [lookup, guarded, confirmed] = state.queries
  assert.deepEqual(lookup, [
    ["select"],
    ["eq", "phone_hmac", "phone-hmac:+447700900123"],
  ])
  assert.deepEqual(guarded, [
    ["eq", "id", "customer-1"],
    ["is", "phone_hmac", null],
    ["select"],
  ])
  assert.deepEqual(confirmed, THIS_CALLS_UNVERIFIED_PHONE)
  assert.deepEqual(state.audits, [
    {
      actor_type: "customer",
      actor_id: "customer-1",
      customer_id: "customer-1",
      target_table: "customers",
      target_id: "customer-1",
      action: "customer_phone_attached",
      metadata: { surface: "profile" },
    },
  ])
  assert.doesNotMatch(JSON.stringify(state.audits), /0123|447700|hmac|cipher/)
  assert.deepEqual(state.logs, [])
  assert.equal(state.afterCalls.length, 1)
  state.afterCalls[0]()
  assert.equal(state.attached, "customer-1")
})

test("Given the audit write fails When a phone is attached Then this call's phone is taken off again and the add is refused", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.updateResults = [STAGED, STAGED]
  state.auditError = { code: "42501", message: "permission denied" }

  const result = await attachVerifiedPhoneToCustomer(ATTACH)

  assert.deepEqual(result, { status: "audit_failed" })
  assert.deepEqual(state.order, ["update", "audit", "update"])
  // Only what this call wrote, and only while the row still holds it
  // unverified; the verified timestamp was never set.
  assert.deepEqual(state.updates[1], RELEASE)
  assert.deepEqual(state.queries[2], THIS_CALLS_UNVERIFIED_PHONE)
  assert.ok(!state.updates.some((update) => "phone_verified_at" in update))
  assert.deepEqual(state.afterCalls, [])
  assert.deepEqual(state.logs, [
    [
      "customer_phone_audit_failed",
      { action: "customer_phone_attached", code: "42501" },
    ],
  ])
  assert.doesNotMatch(JSON.stringify(state.logs), /0123|447700/)
})

test("Given the audit write fails When the staged phone cannot be taken off Then the call throws instead of reporting an outcome", async () => {
  for (const release of [
    { data: null, error: { code: "57014", message: "statement timeout" } },
    // The row no longer holds this call's unverified phone.
    { data: null, error: null },
  ]) {
    const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
    state.updateResults = [STAGED, release]
    state.auditError = { code: "42501", message: "permission denied" }

    await assert.rejects(
      attachVerifiedPhoneToCustomer(ATTACH),
      /Unable to release unaudited customer phone/
    )
    assert.deepEqual(state.updates[1], RELEASE)
    assert.deepEqual(state.afterCalls, [])
  }
})

test("Given the phone is audited When marking it verified fails Then the staged phone is taken off and the call throws", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.updateResults = [
    STAGED,
    { data: null, error: { code: "57014", message: "statement timeout" } },
    STAGED,
  ]

  await assert.rejects(
    attachVerifiedPhoneToCustomer(ATTACH),
    /Unable to confirm customer phone/
  )
  assert.deepEqual(state.order, ["update", "audit", "update", "update"])
  assert.deepEqual(state.updates[2], RELEASE)
  assert.deepEqual(state.afterCalls, [])
})

test("Given another wallet holds the phone When it is attached Then it is a conflict and nothing is written", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.holder = row({ id: "someone-else", phone_last4: "0123" })

  const result = await attachVerifiedPhoneToCustomer({
    customerId: "customer-1",
    phone: PHONE,
    surface: "profile",
  })

  assert.deepEqual(result, { status: "contact_conflict" })
  assert.deepEqual(state.updates, [])
  assert.deepEqual(state.afterCalls, [])
  assert.deepEqual(state.audits, [])
})

test("Given the phone is already this wallet's When it is attached Then nothing changes", async () => {
  const { attachVerifiedPhoneToCustomer, state } = await loadIdentity()
  state.holder = row({ phone_last4: "0123" })

  assert.deepEqual(
    await attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
      surface: "profile",
    }),
    { status: "already_has_phone" }
  )
  assert.deepEqual(state.updates, [])
})

test("Given a race When the unique phone index or the phoneless guard refuses Then the answer is a conflict or no change", async () => {
  const raced = await loadIdentity()
  raced.state.updateResults = [
    { data: null, error: { code: "23505", message: "duplicate key value" } },
  ]
  assert.deepEqual(
    await raced.attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
      surface: "profile",
    }),
    { status: "contact_conflict" }
  )
  assert.deepEqual(raced.state.afterCalls, [])
  assert.deepEqual(raced.state.audits, [])

  const guarded = await loadIdentity()
  guarded.state.updateResults = [{ data: null, error: null }]
  assert.deepEqual(
    await guarded.attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
      surface: "profile",
    }),
    { status: "already_has_phone" }
  )
  assert.deepEqual(guarded.state.audits, [])

  const broken = await loadIdentity()
  broken.state.updateResults = [
    { data: null, error: { code: "42501", message: "permission denied" } },
  ]
  await assert.rejects(
    broken.attachVerifiedPhoneToCustomer({
      customerId: "customer-1",
      phone: PHONE,
      surface: "profile",
    }),
    /Unable to add customer phone/
  )
})
