import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync(
  new URL("../../app/(auth)/actions.ts", import.meta.url),
  "utf8"
)
const accessTokenHook = readFileSync(
  new URL(
    "../../supabase/migrations/20260902138000_reject_password_access_tokens.sql",
    import.meta.url
  ),
  "utf8"
)
const config = readFileSync(
  new URL("../../supabase/config.toml", import.meta.url),
  "utf8"
)
const session = readFileSync(
  new URL("../../lib/auth/session.ts", import.meta.url),
  "utf8"
)
const productionDatabase = readFileSync(
  new URL("../../.github/workflows/production-database.yml", import.meta.url),
  "utf8"
)

test("merchant password auth is rejected at the provider token boundary", () => {
  assert.match(
    config,
    /uri = "pg-functions:\/\/postgres\/public\/reject_password_access_tokens"/
  )
  assert.match(accessTokenHook, /authentication_method = 'password'/)
  assert.match(accessTokenHook, /method ->> 'method' = 'password'/)
  assert.match(accessTokenHook, /'http_code', 403/)
  assert.match(accessTokenHook, /to supabase_auth_admin/)
  assert.match(accessTokenHook, /current_auth_session_is_passwordless/)
  assert.match(
    accessTokenHook,
    /jsonb_typeof\(auth\.jwt\(\) -> 'amr'\) = 'array'[\s\S]*method ->> 'method' = 'password'/
  )
  assert.match(session, /current_auth_session_is_passwordless/)
  assert.match(session, /authMethodError \|\| passwordless !== true/)

  assert.doesNotMatch(actions, /signInWithPassword/)
  assert.doesNotMatch(actions, /resetPasswordForEmail/)
  assert.doesNotMatch(actions, /auth\.updateUser\(\{\s*password/)
  assert.match(actions, /supabase\.auth\.signInWithOtp/)
  assert.match(
    actions,
    /enforceAuthRateLimit\("merchant-verify", context\.email\)[\s\S]*verifyMerchantEmailOtpAlias/
  )

  const migrationAt = productionDatabase.indexOf(
    "supabase db push --linked --include-all"
  )
  const authConfigAt = productionDatabase.indexOf(
    'supabase config push --project-ref "$SUPABASE_PROJECT_REF"'
  )
  assert.ok(migrationAt > 0)
  assert.ok(authConfigAt > migrationAt)
})
