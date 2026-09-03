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
  const expandMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120000_require_activated_admin_mfa.sql"
  )
  const enforceMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120500_enforce_activated_admin_mfa.sql"
  )
  const webAuthnMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120200_support_admin_webauthn_mfa.sql"
  )

  assert.match(expandMigration, /factor\.id = admin\.mfa_factor_id/)
  assert.match(expandMigration, /factor\.status = 'verified'/)
  assert.match(
    expandMigration,
    /select count\(\*\)[\s\S]*verified_factor\.status = 'verified'[\s\S]*\) = 1/
  )
  assert.match(
    expandMigration,
    /create or replace function public\.is_internal_admin/
  )
  assert.match(
    enforceMigration,
    /where admin\.is_active[\s\S]*not public\.has_activated_admin_mfa\(admin\.user_id\)/
  )
  assert.match(enforceMigration, /raise check_violation/)
  assert.doesNotMatch(
    enforceMigration,
    /create or replace function public\.is_internal_admin/
  )
  assert.match(expandMigration, /request_assurance_level\(\)\) = 'aal2'/)
  assert.match(
    expandMigration,
    /mfa_activated_at = date_trunc\('second', clock_timestamp\(\)\)\s*\+ interval '1 second'/
  )
  assert.match(
    expandMigration,
    /auth_session\.factor_id = admin\.mfa_factor_id/
  )
  assert.match(expandMigration, /amr\.updated_at > admin\.mfa_activated_at/)
  assert.match(
    expandMigration,
    /method ->> 'timestamp'[\s\S]*floor\(extract\(epoch from amr\.updated_at\)\)/
  )
  assert.match(
    expandMigration,
    /revoke all on function public\.has_activated_admin_mfa\(uuid\)[\s\S]*from public, anon, authenticated/
  )
  assert.match(webAuthnMigration, /factor\.factor_type = 'webauthn'/)
  assert.match(
    webAuthnMigration,
    /web_authn_credential #>> '\{flags,userVerified\}'[\s\S]*= 'true'/
  )
  assert.match(webAuthnMigration, /authentication_method = 'mfa\/webauthn'/)
  assert.match(webAuthnMigration, /method ->> 'method' = 'mfa\/webauthn'/)
  assert.match(
    webAuthnMigration,
    /activate_internal_admin_mfa\([\s\S]*is_service_role_request\(\)[\s\S]*factor\.id = p_factor_id[\s\S]*factor\.factor_type = 'webauthn'[\s\S]*factor\.status = 'verified'/
  )
  assert.match(expandMigration, /'admin_mfa_factor_activated'/)
  assert.match(
    expandMigration,
    /revoke all on function public\.activate_internal_admin_mfa\(uuid, uuid\)[\s\S]*from public, anon, authenticated/
  )
})

test("production activation is protected, exact-revision and identifier-safe", () => {
  const workflow = readProjectFile(
    ".github",
    "workflows",
    "admin-mfa-activation.yml"
  )

  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /environment: Production/)
  assert.match(workflow, /git rev-parse origin\/main/)
  assert.match(workflow, /ACTIVATE_VERIFIED_ADMIN_MFA/)
  assert.match(workflow, /uuid_pattern=/)
  assert.match(workflow, /public\.activate_internal_admin_mfa/)
  assert.match(workflow, /\\\$1::uuid, \\\$2::uuid/)
  assert.match(workflow, /parameters: \[\$admin_user_id, \$factor_id\]/)
  assert.equal(
    workflow
      .split(/\r?\n/)
      .some(
        (line) =>
          line.trim() ===
          '"https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query")"'
      ),
    true
  )
  assert.match(workflow, /\.\[0\]\.activated == true/)
  assert.doesNotMatch(workflow, /echo.*(?:ADMIN_USER_ID|FACTOR_ID)/)
})

test("direct Auth enrolment cannot add an attacker-controlled second factor", () => {
  const config = readProjectFile("supabase", "config.toml")
  assert.match(config, /\[auth\.mfa\][\s\S]*max_enrolled_factors = 1/)
  assert.match(
    config,
    /\[auth\.mfa\.web_authn\][\s\S]*enroll_enabled = true[\s\S]*verify_enabled = true/
  )
  assert.match(
    config,
    /\[auth\.mfa\.totp\][\s\S]*enroll_enabled = false[\s\S]*verify_enabled = false/
  )
  assert.match(config, /rp_id = "nabaperks\.com"/)
})

test("the compatibility bootstrap preserves the independent activation boundary", () => {
  const route = readProjectFile(
    "app",
    "api",
    "admin-mfa-bootstrap",
    "authorize",
    "route.ts"
  )
  const workflow = readProjectFile(
    ".github",
    "workflows",
    "admin-mfa-bootstrap.yml"
  )

  assert.match(route, /supabase\.auth\.getUser\(\)/)
  assert.match(route, /internal_admins/)
  assert.match(route, /admin\?\.is_active !== true/)
  assert.match(route, /verifiedFactors\.length !== 0/)
  assert.match(workflow, /environment: Production/)
  assert.match(workflow, /20260902120200/)
  assert.match(workflow, /20260902120500/)
  assert.match(workflow, /sole_active_admin/)
  assert.match(workflow, /active_admin_is_factorless/)
  assert.match(workflow, /--prod/)
  assert.match(workflow, /--skip-domain/)
  assert.doesNotMatch(workflow, /activate_internal_admin_mfa/)
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
  assert.match(migration, /mfa_activated_at = null/i)
  assert.match(
    migration,
    /mfa_activated_at = date_trunc\('second', clock_timestamp\(\)\)\s*\+ interval '1 second'/
  )
  assert.match(migration, /admin_mfa_binding_invalidated/)
  assert.match(migration, /admin_mfa_factor_unenrolled/)
  assert.match(migration, /Use the audited admin MFA lifecycle boundary/)
  assert.match(
    migration,
    /coalesce\(current_setting\('app\.admin_mfa_binding_change', true\), ''\)[\s\S]*not in/
  )
  assert.match(migration, /'trusted_activation'/)
  assert.match(migration, /before insert on public\.internal_admins/i)
  assert.match(
    migration,
    /before update of mfa_factor_id, mfa_activated_at on public\.internal_admins/i
  )
})
