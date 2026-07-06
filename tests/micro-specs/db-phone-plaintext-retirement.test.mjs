import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// MS-db-phone-plaintext-retirement — pins the retirement contract:
//   1. the migration backfills last4 BEFORE the guarded drop, swaps the
//      contact CHECK to email | phone_hmac | phone_last4, and recreates the
//      masked view + verified-contact trigger without plaintext references;
//   2. the two historical files that read the column at the top level
//      (the phone-identity backfill/CHECK and the masked-view backstop) are
//      replay-guarded on the column's existence; and
//   3. no app select carries plaintext customer phone any more.
// Behavior: tests/db/phone-plaintext-retirement.test.mjs.

const migration = readFileSync(
  "supabase/migrations/20260707095000_phone_plaintext_retirement.sql",
  "utf8"
)
const identityGuard = readFileSync(
  "supabase/migrations/20260613210000_customer_phone_identity.sql",
  "utf8"
)
const viewGuard = readFileSync(
  "supabase/migrations/20260630128000_mask_customer_contact_backstop.sql",
  "utf8"
)
const identity = readFileSync("lib/customer/identity.ts", "utf8")
const adminData = readFileSync("lib/admin/data.ts", "utf8")
const demoSeed = readFileSync("supabase/seed-activity-demo.sql", "utf8")

test("the migration backfills, re-checks, recreates, then drops", () => {
  assert.match(
    migration,
    /set phone_last4 = nullif\(right\(regexp_replace\(phone/,
    "legacy last4 is backfilled from the plaintext digits before the drop"
  )
  assert.match(
    migration,
    /check \(email is not null or phone_hmac is not null or phone_last4 is not null\)/,
    "the contact CHECK accepts email | phone_hmac | phone_last4"
  )
  assert.match(
    migration,
    /drop column if exists phone/,
    "the plaintext column is dropped with a guard"
  )
  const dropAt = migration.indexOf("drop column if exists phone")
  const backfillAt = migration.indexOf("set phone_last4 = nullif")
  assert.ok(backfillAt < dropAt, "the backfill runs before the drop")
  assert.match(
    migration,
    /grant execute on function public\.get_reward_scan_context[\s\S]{0,80}to service_role/,
    "the reshaped scan-context keeps its service-role-only grant"
  )
})

test("the historical top-level readers are replay-guarded", () => {
  for (const [name, source] of [
    ["customer_phone_identity", identityGuard],
    ["mask_customer_contact_backstop", viewGuard],
  ]) {
    assert.match(
      source,
      /information_schema\.columns[\s\S]{0,160}column_name = 'phone'/,
      `${name} skips its plaintext-phone work once the column is dropped`
    )
  }
})

test("app selects no longer carry plaintext customer phone", () => {
  assert.ok(
    !identity.includes("date_of_birth, phone,"),
    "CUSTOMER_COLUMNS selects the masked fields only"
  )
  assert.match(
    identity,
    /phone: maskedPhoneFromLast4\(phoneLast4\)/,
    "CurrentCustomer.phone is always the masked form"
  )
  assert.ok(
    !adminData.includes("customers(email, phone)") &&
      !adminData.includes("customers!inner(email, phone)"),
    "admin lookups join phone_last4, never plaintext phone"
  )
  assert.match(demoSeed, /phone_last4/, "the demo seed feeds last4, not plaintext")
})
