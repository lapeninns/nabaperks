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

test("admin authority requires trusted factor activation and aal2", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120000_require_activated_admin_mfa.sql"
  )

  assert.match(migration, /factor\.id = admin\.mfa_factor_id/)
  assert.match(migration, /factor\.status = 'verified'/)
  assert.match(
    migration,
    /select count\(\*\)[\s\S]*verified_factor\.status = 'verified'[\s\S]*\) = 1/
  )
  assert.match(migration, /request_assurance_level\(\)\) = 'aal2'/)
  assert.match(
    migration,
    /revoke all on function public\.has_activated_admin_mfa\(uuid\)[\s\S]*from public, anon, authenticated/
  )
  assert.match(
    migration,
    /activate_internal_admin_mfa\([\s\S]*is_service_role_request\(\)[\s\S]*factor\.id = p_factor_id[\s\S]*factor\.factor_type = 'totp'[\s\S]*factor\.status = 'verified'/
  )
  assert.match(migration, /'admin_mfa_factor_activated'/)
  assert.match(
    migration,
    /revoke all on function public\.activate_internal_admin_mfa\(uuid, uuid\)[\s\S]*from public, anon, authenticated/
  )
})

test("direct Auth enrolment cannot add an attacker-controlled second factor", () => {
  const config = readProjectFile("supabase", "config.toml")
  assert.match(config, /\[auth\.mfa\][\s\S]*max_enrolled_factors = 1/)
})

test("factor lifecycle changes invalidate binding and direct DML is guarded", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260902134000_invalidate_admin_mfa_on_factor_changes.sql"
  )

  assert.match(
    migration,
    /after insert or delete or update of user_id, status, factor_type[\s\S]*on auth\.mfa_factors/i
  )
  assert.match(migration, /set mfa_factor_id = null/i)
  assert.match(migration, /admin_mfa_binding_invalidated/)
  assert.match(migration, /admin_mfa_factor_unenrolled/)
  assert.match(migration, /Use the audited admin MFA lifecycle boundary/)
  assert.match(
    migration,
    /coalesce\(current_setting\('app\.admin_mfa_binding_change', true\), ''\)[\s\S]*not in/
  )
  assert.match(migration, /'trusted_activation'/)
  assert.match(migration, /before insert on public\.internal_admins/i)
})
