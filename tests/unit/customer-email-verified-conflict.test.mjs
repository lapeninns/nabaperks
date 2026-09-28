import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * One wallet per verified email. `markCustomerEmailVerified` refuses to confirm
 * an address another customer already holds as verified — by a pre-check on
 * the verified `email_hmac`, by catching the unique violation (23505) that the
 * database index raises, and by re-checking after its own write so two racing
 * confirmations cannot both stand. Either way this customer is left without
 * the address verified, and the caller receives `conflict`.
 */
// The guarded write that releases a refused, still-unverified address, and
// only while the profile keeps a phone (customers_contact_present).
const RELEASE_OPS = [
  ["update", { email: null, email_hmac: null, email_verified_at: null }],
  ["eq", "id", "customer-a"],
  ["eq", "email", "guest@example.test"],
  ["is", "email_verified_at", null],
  ["or", "phone_hmac.not.is.null,phone_last4.not.is.null"],
  ["select", "id"],
]

async function loadProfile() {
  const modules = {
    "fixture-state": `export const state = {
      customer: { id: "customer-a", email: null, emailVerifiedAt: null },
      heldByOther: false,
      // Per-query answers for the holder check, in order; then heldByOther.
      holderResults: [],
      updateError: null,
      laterUpdateErrors: [],
      releasedRows: [],
      queries: [],
      updates: [],
      audits: [],
      auditError: null,
      logs: [],
      afterCalls: 0,
    };`,
    "server-only": "",
    "next/server":
      'import { state } from "fixture-state"; export function after() { state.afterCalls += 1 }',
    "@/lib/customer/identity":
      'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
    "@/lib/customer/email-pii-core":
      'export function customerEmailHmac(email) { return "hmac:" + email } export function normalizeEmail(email) { return email.trim().toLowerCase() }',
    "@/lib/customer/profile-completion":
      "export function profileCompletionFrom(customer) { return customer }",
    "@/lib/customer/reward-invites":
      "export function attachRewardInvitesForCustomer() {}",
    "@/lib/observability/logger":
      'import { state } from "fixture-state"; export const logger = { error(message, context) { state.logs.push([message, context]) }, warn(message, context) { state.logs.push([message, context]) } }',
    "@/lib/supabase/server": `import { state } from "fixture-state";
      function builder() {
        const ops = []
        const chain = {
          select(columns) { ops.push(["select", columns]); return chain },
          update(values) { ops.push(["update", values]); return chain },
          eq(column, value) { ops.push(["eq", column, value]); return chain },
          not(column, operator, value) { ops.push(["not", column, operator, value]); return chain },
          neq(column, value) { ops.push(["neq", column, value]); return chain },
          is(column, value) { ops.push(["is", column, value]); return chain },
          or(filters) { ops.push(["or", filters]); return chain },
          limit(count) { ops.push(["limit", count]); return chain },
          then(resolve, reject) {
            const isUpdate = ops[0][0] === "update"
            let result
            if (isUpdate) {
              state.updates.push(ops)
              // The first write is the confirmation; later ones take their own errors.
              const error = state.updates.length === 1
                ? state.updateError
                : (state.laterUpdateErrors.shift() ?? null)
              const returning = ops.some(([op]) => op === "select")
              result = { data: returning ? state.releasedRows : null, error }
            } else {
              state.queries.push(ops)
              const held = state.holderResults.length > 0
                ? state.holderResults.shift()
                : state.heldByOther
              result = { data: held ? [{ id: "customer-b" }] : [], error: null }
            }
            return Promise.resolve(result).then(resolve, reject)
          },
        }
        return chain
      }
      function auditLogs() {
        return {
          insert(row) {
            state.audits.push(row)
            return Promise.resolve({ error: state.auditError })
          },
        }
      }
      export function createSupabaseServiceRoleClient() {
        return {
          from(table) {
            if (table === "audit_logs") return auditLogs()
            if (table !== "customers") throw new Error(table)
            return builder()
          },
        }
      }`,
  }
  const result = await build({
    stdin: {
      contents:
        'export * from "./lib/customer/profile.ts"; export { state } from "fixture-state";',
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
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
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

test("Given another wallet holds the verified email When the code is confirmed Then nothing is confirmed and the result is conflict", async () => {
  const profile = await loadProfile()
  profile.state.heldByOther = true

  const result = await profile.markCustomerEmailVerified(" Guest@Example.test ")

  assert.deepEqual(result, { status: "conflict" })
  // Only the guarded release is attempted; no row matched, so no audit.
  assert.deepEqual(profile.state.updates, [RELEASE_OPS])
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.state.afterCalls, 0)
  // The pre-check looks only at *verified* holders other than this customer.
  assert.deepEqual(profile.state.queries[0], [
    ["select", "id"],
    ["eq", "email_hmac", "hmac:guest@example.test"],
    ["not", "email_verified_at", "is", null],
    ["neq", "id", "customer-a"],
    ["limit", 1],
  ])
})

test("Given a concurrent confirmation wins the unique index When the update raises 23505 Then the result is conflict, not an error", async () => {
  const profile = await loadProfile()
  profile.state.updateError = {
    code: "23505",
    message: "duplicate key value violates unique constraint",
  }

  const result = await profile.markCustomerEmailVerified("guest@example.test")

  assert.deepEqual(result, { status: "conflict" })
  assert.equal(profile.state.updates.length, 2)
  assert.deepEqual(profile.state.updates[1], RELEASE_OPS)
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.state.afterCalls, 0)
})

test("Given the address is verified elsewhere under a different HMAC When the address index raises 23505 Then the result is conflict", async () => {
  const profile = await loadProfile()
  // The HMAC pre-check finds nothing; only the address index catches it.
  profile.state.updateError = {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "customers_verified_email_address_unique_idx"',
  }

  const result = await profile.markCustomerEmailVerified("guest@example.test")

  assert.deepEqual(result, { status: "conflict" })
  assert.equal(profile.state.queries.length, 1)
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.state.afterCalls, 0)
})

test("Given any other database failure When the code is confirmed Then it still throws", async () => {
  const profile = await loadProfile()
  profile.state.updateError = { code: "57014", message: "statement timeout" }

  await assert.rejects(
    profile.markCustomerEmailVerified("guest@example.test"),
    /Unable to confirm email/
  )
})

test("Given the email is free When the code is confirmed Then it is verified with its HMAC and invites are attached", async () => {
  const profile = await loadProfile()

  const result = await profile.markCustomerEmailVerified(
    "guest@example.test",
    "home_prompt"
  )

  assert.deepEqual(result, { status: "verified" })
  // Pre-check and post-write re-check both ran and found no other holder.
  assert.equal(profile.state.queries.length, 2)
  assert.deepEqual(profile.state.queries[1], profile.state.queries[0])
  assert.equal(profile.state.updates.length, 1)
  const [update, eq] = profile.state.updates[0]
  assert.equal(update[0], "update")
  assert.equal(update[1].email, "guest@example.test")
  assert.equal(update[1].email_hmac, "hmac:guest@example.test")
  assert.match(update[1].email_verified_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual(eq, ["eq", "id", "customer-a"])
  assert.equal(profile.state.afterCalls, 1)
  // Durable evidence of the confirmation, naming the surface but no contact.
  assert.deepEqual(profile.state.audits, [
    {
      actor_type: "customer",
      actor_id: "customer-a",
      customer_id: "customer-a",
      target_table: "customers",
      target_id: "customer-a",
      action: "customer_email_verified",
      metadata: { surface: "home_prompt" },
    },
  ])
})

test("Given a locked email with a stale HMAC When it is re-confirmed Then only the HMAC is rewritten and the repair is audited", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "kept@example.test",
    emailVerifiedAt: "2026-09-01T00:00:00.000Z",
  }

  const result = await profile.markCustomerEmailVerified("kept@example.test")

  assert.deepEqual(result, { status: "verified" })
  assert.deepEqual(profile.state.updates[0][0], [
    "update",
    { email_hmac: "hmac:kept@example.test" },
  ])
  // Nothing newly verified, so no post-write re-check.
  assert.equal(profile.state.queries.length, 1)
  assert.equal(profile.state.afterCalls, 0)
  assert.deepEqual(profile.state.audits[0].metadata, {
    hmac_repair_only: true,
  })
})

test("Given the audit write fails When the code is confirmed Then the committed confirmation stands and the failure is logged without contact data", async () => {
  const profile = await loadProfile()
  profile.state.auditError = { code: "42501", message: "permission denied" }

  const result = await profile.markCustomerEmailVerified("guest@example.test")

  assert.deepEqual(result, { status: "verified" })
  assert.equal(profile.state.audits.length, 1)
  assert.deepEqual(profile.state.logs, [
    [
      "customer_email_audit_failed",
      { action: "customer_email_verified", code: "42501" },
    ],
  ])
  assert.doesNotMatch(JSON.stringify(profile.state.logs), /example\.test/)
})

test("Given a new address When only the email is saved Then its verification is cleared and nothing else is written", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "old@example.test",
    emailVerifiedAt: null,
  }

  const result = await profile.setCustomerEmailForVerification(
    "New@Example.test",
    "stamp_prompt"
  )

  assert.deepEqual(result, {
    status: "verification_required",
    email: "new@example.test",
  })
  assert.deepEqual(profile.state.updates[0][0], [
    "update",
    { email: "new@example.test", email_hmac: null, email_verified_at: null },
  ])
  // The change is audited before any code is sent, without the address.
  assert.deepEqual(profile.state.audits, [
    {
      actor_type: "customer",
      actor_id: "customer-a",
      customer_id: "customer-a",
      target_table: "customers",
      target_id: "customer-a",
      action: "customer_email_submitted",
      metadata: { surface: "stamp_prompt" },
    },
  ])
})

test("Given the same unverified address When only the email is saved Then no write is needed", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "same@example.test",
    emailVerifiedAt: null,
  }

  const result = await profile.setCustomerEmailForVerification(
    "same@example.test",
    "home_prompt"
  )

  assert.equal(result.status, "verification_required")
  assert.deepEqual(profile.state.updates, [])
  assert.deepEqual(profile.state.audits, [])
})

test("Given a verified email When another address is offered Then the verified email stays locked", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "kept@example.test",
    emailVerifiedAt: "2026-09-01T00:00:00.000Z",
  }

  assert.deepEqual(
    await profile.setCustomerEmailForVerification(
      "other@example.test",
      "home_prompt"
    ),
    { status: "already_verified" }
  )
  assert.deepEqual(profile.state.updates, [])
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.customerHasVerifiedEmail(profile.state.customer), true)
  assert.equal(
    profile.customerHasVerifiedEmail({
      email: "kept@example.test",
      emailVerifiedAt: null,
    }),
    false
  )
  assert.equal(
    profile.customerHasVerifiedEmail({
      email: " ",
      emailVerifiedAt: "2026-09-01T00:00:00.000Z",
    }),
    false
  )
})

test("Given a racing confirmation of the same address When the post-write re-check finds another holder Then this confirmation is withdrawn and the result is conflict", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "guest@example.test",
    emailVerifiedAt: null,
  }
  // Free at the pre-check; held by the other racer at the re-check.
  profile.state.holderResults = [false, true]

  const result = await profile.markCustomerEmailVerified(
    "guest@example.test",
    "home_prompt"
  )

  assert.deepEqual(result, { status: "conflict" })
  assert.equal(profile.state.queries.length, 2)
  const [confirm, withdraw, release] = profile.state.updates
  const verifiedAt = confirm[0][1].email_verified_at
  assert.match(verifiedAt, /^\d{4}-\d{2}-\d{2}T/)
  // Only this call's own confirmation is undone, back to the earlier state.
  assert.deepEqual(withdraw, [
    [
      "update",
      {
        email: "guest@example.test",
        email_hmac: null,
        email_verified_at: null,
      },
    ],
    ["eq", "id", "customer-a"],
    ["eq", "email_verified_at", verifiedAt],
  ])
  assert.deepEqual(release, RELEASE_OPS)
  // No verified row for a withdrawn confirmation, and no invite attachment.
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.state.afterCalls, 0)
})

test("Given the post-write re-check is clean When the code is confirmed Then it stays verified and is audited once", async () => {
  const profile = await loadProfile()
  profile.state.holderResults = [false, false]

  const result = await profile.markCustomerEmailVerified(
    "guest@example.test",
    "stamp_prompt"
  )

  assert.deepEqual(result, { status: "verified" })
  assert.equal(profile.state.queries.length, 2)
  assert.equal(profile.state.updates.length, 1)
  assert.deepEqual(
    profile.state.audits.map((row) => [row.action, row.metadata]),
    [["customer_email_verified", { surface: "stamp_prompt" }]]
  )
  assert.equal(profile.state.afterCalls, 1)
})

test("Given the withdrawal itself fails When the re-check finds another holder Then it throws rather than claim a conflict over a standing duplicate", async () => {
  const profile = await loadProfile()
  profile.state.holderResults = [false, true]
  profile.state.laterUpdateErrors = [{ code: "57014", message: "timeout" }]

  await assert.rejects(
    profile.markCustomerEmailVerified("guest@example.test"),
    /Unable to withdraw email confirmation/
  )
  assert.deepEqual(profile.state.audits, [])
  assert.deepEqual(profile.state.logs, [
    ["customer_email_confirmation_withdraw_failed", { code: "57014" }],
  ])
})

test("Given a conflict and a profile that keeps a phone When the refused address is released Then the clearing is audited without contact data", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "guest@example.test",
    emailVerifiedAt: null,
  }
  profile.state.heldByOther = true
  profile.state.releasedRows = [{ id: "customer-a" }]

  const result = await profile.markCustomerEmailVerified(
    "guest@example.test",
    "home_prompt"
  )

  assert.deepEqual(result, { status: "conflict" })
  assert.deepEqual(profile.state.updates, [RELEASE_OPS])
  assert.deepEqual(profile.state.audits, [
    {
      actor_type: "customer",
      actor_id: "customer-a",
      customer_id: "customer-a",
      target_table: "customers",
      target_id: "customer-a",
      action: "customer_email_cleared",
      metadata: { surface: "home_prompt", reason: "email_in_use" },
    },
  ])
})

test("Given a conflict When the release write fails Then the conflict answer stands and the failure is logged without contact data", async () => {
  const profile = await loadProfile()
  profile.state.heldByOther = true
  // The release is the first write here, so it takes the first-write error.
  profile.state.updateError = { code: "57014", message: "timeout" }

  const result = await profile.markCustomerEmailVerified("guest@example.test")

  assert.deepEqual(result, { status: "conflict" })
  assert.deepEqual(profile.state.audits, [])
  assert.deepEqual(profile.state.logs, [
    ["customer_email_conflict_release_failed", { code: "57014" }],
  ])
  assert.doesNotMatch(JSON.stringify(profile.state.logs), /example\.test/)
})

test("Given a locked email and another holder When it is re-confirmed Then the verified address is never released", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: "kept@example.test",
    emailVerifiedAt: "2026-09-01T00:00:00.000Z",
  }
  profile.state.heldByOther = true

  const result = await profile.markCustomerEmailVerified("kept@example.test")

  assert.deepEqual(result, { status: "conflict" })
  assert.deepEqual(profile.state.updates, [])
  assert.deepEqual(profile.state.audits, [])
})
