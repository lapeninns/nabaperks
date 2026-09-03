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

test("provider access-token hook rejects every password-origin token", () => {
  const config = readProjectFile("supabase", "config.toml")
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260902138000_reject_password_access_tokens.sql"
  )

  assert.match(config, /\[auth\.hook\.custom_access_token\]/)
  assert.match(
    config,
    /uri = "pg-functions:\/\/postgres\/public\/reject_password_access_tokens"/
  )
  assert.match(migration, /authentication_method = 'password'/)
  assert.match(migration, /method ->> 'method' = 'password'/)
  assert.match(migration, /'http_code', 403/)
  assert.match(migration, /return jsonb_build_object\('claims', claims\)/)
  assert.match(migration, /grant execute[\s\S]*to supabase_auth_admin/)
  assert.match(
    migration,
    /revoke all[\s\S]*from public, anon, authenticated, service_role, supabase_auth_admin/
  )
})

test("signup and sign-in expose accessible email-code controls without password inputs", () => {
  const signup = readProjectFile(
    "components",
    "auth",
    "signup-details-form.tsx"
  )
  const reset = readProjectFile("components", "auth", "reset-password-form.tsx")

  assert.doesNotMatch(signup, /password/i)
  assert.doesNotMatch(reset, /name="password"|new-password|current-password/)
  assert.match(reset, /autoComplete="one-time-code"/)
  assert.match(reset, /role="status" aria-live="polite"/)
})

test("focused auth keeps one linked home mark and a static footer wordmark", () => {
  const logo = readProjectFile("components", "brand", "logo.tsx")
  const layout = readProjectFile("components", "layout", "marketing-layout.tsx")

  assert.match(logo, /linked = true/)
  assert.match(logo, /if \(!linked\)/)
  assert.match(layout, /focused[\s\S]*<Logo[^>]*linked=\{false\}/)
})

test("merchant product code has no password authentication or replacement sink", () => {
  const actions = readProjectFile("app", "(auth)", "actions.ts")

  assert.doesNotMatch(actions, /signInWithPassword|resetPasswordForEmail/)
  assert.doesNotMatch(actions, /auth\.updateUser\(\{\s*password/)
  assert.match(actions, /signInWithOtp/)
  assert.match(actions, /verifyOtp/)
})
