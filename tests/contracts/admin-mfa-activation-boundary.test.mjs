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
})

test("direct Auth enrolment cannot add an attacker-controlled second factor", () => {
  const config = readProjectFile("supabase", "config.toml")
  assert.match(config, /\[auth\.mfa\][\s\S]*max_enrolled_factors = 1/)
})
