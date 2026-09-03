import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("customer-entered DOB is separated from verified reward eligibility", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260902136000_require_verified_date_of_birth.sql"
  )

  assert.match(migration, /date_of_birth_verified_at timestamptz/)
  assert.match(migration, /date_of_birth_verification_source text/)
  assert.match(migration, /protect_customer_date_of_birth_verification/)
  assert.match(migration, /Customer\/profile writes cannot populate this field/)
  assert.match(migration, /customer_has_verified_adult_date_of_birth/)
  assert.match(migration, /reward_scan_tokens_require_verified_dob/)
  assert.match(migration, /reward_events_require_verified_dob/)
  assert.match(migration, /customers_retire_reward_tokens_after_dob_change/)
  assert.match(migration, /source = 'birthday_month'/)
  assert.match(migration, /status = 'redeemed'/)
})

test("DOB verification is an MFA-gated, audited internal-admin workflow", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260902136000_require_verified_date_of_birth.sql"
  )
  const actions = readProjectFile("app", "admin", "actions.ts")
  const data = readProjectFile("lib", "admin", "data.ts")
  const panel = readProjectFile(
    "app",
    "admin",
    "customers",
    "customer-memberships-panel.tsx"
  )
  const rewardPanel = readProjectFile(
    "components",
    "customer",
    "reward-panels.tsx"
  )
  const rewardQrRoute = readProjectFile(
    "app",
    "reward",
    "[rewardId]",
    "qr.png",
    "route.ts"
  )

  assert.match(migration, /admin_verify_customer_date_of_birth/)
  assert.match(migration, /not public\.is_internal_admin\(\)/)
  assert.match(migration, /customer_date_of_birth_verified/)
  assert.match(
    migration,
    /revoke all on function public\.admin_verify_customer_date_of_birth[\s\S]*from public, anon, authenticated, service_role/
  )
  assert.match(
    migration,
    /grant execute on function public\.admin_verify_customer_date_of_birth[\s\S]*to authenticated, service_role/
  )
  assert.match(actions, /verifyCustomerDateOfBirthAction/)
  assert.match(
    actions,
    /await requireAdminAction\(\)[\s\S]*admin_verify_customer_date_of_birth/
  )
  assert.match(data, /date_of_birth_verified_at/)
  assert.match(panel, /Confirm only after checking reliable evidence\./)
  assert.match(panel, /Verify date of birth/)
  assert.match(rewardPanel, /profileGate\.dateOfBirthVerified/)
  assert.match(rewardPanel, /Date of birth check needed/)
  assert.match(rewardQrRoute, /!profile\.dateOfBirthVerified/)
})
