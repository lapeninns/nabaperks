import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (...segments) => readFileSync(path.join(root, ...segments), "utf8")
const bridge = () =>
  read(
    "supabase",
    "migrations",
    "20260902120300_support_admin_passkey_step_up.sql"
  )

test("dormant passkey grants remain exact-session bound but do not control admin authority", () => {
  const migration = bridge()
  const policy = read(
    "supabase",
    "migrations",
    "20260903133000_accept_single_factor_admin_policy.sql"
  )
  assert.match(migration, /admin\.mfa_factor_id = credential\.id/)
  assert.match(migration, /credential\.user_id = admin\.user_id/)
  assert.match(migration, /credential\.revoked_at is null/)
  assert.match(migration, /step_up\.verified_at > admin\.mfa_activated_at/)
  assert.match(migration, /step_up\.expires_at > clock_timestamp\(\)/)
  assert.match(migration, /join auth\.sessions auth_session/)
  assert.match(
    migration,
    /create or replace function public\.is_internal_admin\(\)[\s\S]*request_has_post_activation_admin_mfa/
  )
  assert.doesNotMatch(
    migration.match(
      /create or replace function public\.is_internal_admin\(\)([\s\S]*?)\$\$;/
    )?.[1] ?? "",
    /aal2/
  )
  assert.match(
    policy,
    /create or replace function public\.is_internal_admin\(\)[\s\S]*admin\.user_id = auth\.uid\(\)[\s\S]*admin\.is_active/
  )
  assert.doesNotMatch(policy, /request_has_post_activation_admin_mfa/)
})

test("challenges are purpose and session bound, short-lived and consumed once", () => {
  const migration = bridge()
  assert.match(migration, /purpose in \('registration', 'authentication'\)/)
  assert.match(migration, /session_id uuid not null references auth\.sessions/)
  assert.match(migration, /interval '5 minutes'/)
  assert.match(
    migration,
    /challenge\.session_id = public\.request_auth_session_id\(\)/
  )
  assert.match(migration, /challenge\.purpose = p_purpose/)
  assert.match(migration, /challenge\.origin = p_origin/)
  assert.match(migration, /challenge\.consumed_at is null/)
  assert.match(migration, /set consumed_at = clock_timestamp\(\)/)
})

test("credential tables are service-only and ceremony attempts are durably limited", () => {
  const migration = bridge()
  for (const table of [
    "admin_webauthn_credentials",
    "admin_webauthn_challenges",
    "admin_webauthn_grants",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security`)
    )
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}[\\s\\S]*from public, anon, authenticated, service_role`
      )
    )
  }
  assert.match(migration, /perform public\.enforce_rate_limit\(/)
})

test("production activation remains protected, exact-revision and identifier-safe", () => {
  const workflow = read(".github", "workflows", "admin-mfa-activation.yml")
  assert.match(workflow, /environment: Production/)
  assert.match(workflow, /git rev-parse origin\/main/)
  assert.match(workflow, /ACTIVATE_VERIFIED_ADMIN_MFA/)
  assert.match(workflow, /public\.activate_internal_admin_mfa/)
  assert.match(workflow, /parameters: \[\$admin_user_id, \$credential_id\]/)
  assert.doesNotMatch(workflow, /echo.*(?:ADMIN_USER_ID|CREDENTIAL_ID)/)
})

test("bootstrap deploys the verifier before publishing the fixed origin and never activates authority", () => {
  const workflow = read(".github", "workflows", "admin-mfa-bootstrap.yml")
  const staticEntry = read("scripts", "admin-mfa-bootstrap-entry.mjs")
  const builder = read("scripts", "build-admin-mfa-bootstrap.mjs")
  const deployIndex = workflow.indexOf(
    "supabase functions deploy admin-webauthn"
  )
  const parserFixtureIndex = workflow.indexOf(
    "Generate a non-deployable parser-only hook fixture"
  )
  const aliasIndex = workflow.indexOf("vercel alias set")
  const preDeploy = workflow.slice(0, deployIndex)

  assert.match(workflow, /20260902120300/)
  assert.ok(parserFixtureIndex >= 0 && parserFixtureIndex < deployIndex)
  assert.match(
    workflow,
    /SUPABASE_SEND_EMAIL_HOOK_URI: https:\/\/nabaperks\.com/
  )
  assert.match(preDeploy, /parser_secret=.*openssl rand -base64 32/)
  assert.match(
    preDeploy,
    /printf 'SUPABASE_SEND_EMAIL_HOOK_SECRET=%s\\n' "\$parser_secret" >> "\$GITHUB_ENV"/
  )
  assert.doesNotMatch(workflow, /secrets\.SUPABASE_SEND_EMAIL_HOOK_SECRET/)
  assert.doesNotMatch(workflow, /config\s+push/)
  assert.ok(deployIndex >= 0 && deployIndex < aliasIndex)
  assert.match(workflow, /mfa_totp_enroll_enabled.*false/)
  assert.doesNotMatch(workflow, /mfa_web_authn_enroll_enabled.*true/)
  assert.doesNotMatch(workflow, /activate_internal_admin_mfa/)
  assert.match(staticEntry, /registerAdminWebAuthnFactor/)
  assert.match(
    builder,
    /const APPROVED_ORIGIN = "https:\/\/mfa\.nabaperks\.com"/
  )
  assert.match(builder, /frame-ancestors 'none'/)
})

test("later migrations preserve application-owned credential lifecycle", () => {
  const finalMigration = read(
    "supabase",
    "migrations",
    "20260903132000_preserve_admin_passkey_step_up.sql"
  )
  assert.match(
    finalMigration,
    /drop trigger if exists mfa_factors_invalidate_internal_admin_binding/
  )
  assert.match(finalMigration, /public\.admin_webauthn_credentials/)
  assert.match(finalMigration, /'trusted_activation'/)
  assert.match(finalMigration, /'factor_lifecycle'/)
  assert.match(finalMigration, /after update of is_active/)
})
