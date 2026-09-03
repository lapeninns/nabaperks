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
const productionDeploy = readFileSync(
  new URL("../../.github/workflows/production-deploy.yml", import.meta.url),
  "utf8"
)

test("merchant password auth is rejected at the provider token boundary", () => {
  assert.match(
    config,
    /uri = "pg-functions:\/\/postgres\/public\/reject_password_access_tokens"/
  )
  assert.match(accessTokenHook, /authentication_method = 'password'/)
  assert.match(accessTokenHook, /method ->> 'method' = 'password'/)
  assert.match(accessTokenHook, /method ->> 'method' in \('otp', 'totp'\)/)
  assert.match(accessTokenHook, /or not has_passwordless_method/)
  assert.match(accessTokenHook, /'http_code', 403/)
  assert.match(accessTokenHook, /to supabase_auth_admin/)
  assert.match(accessTokenHook, /current_auth_session_is_passwordless/)
  assert.match(
    accessTokenHook,
    /jsonb_typeof\(auth\.jwt\(\) -> 'amr'\) = 'array'[\s\S]*method ->> 'method' in \('otp', 'totp'\)[\s\S]*method ->> 'method' = 'password'/
  )
  assert.match(accessTokenHook, /enforce_passwordless_data_api_session/)
  assert.match(
    accessTokenHook,
    /alter role authenticator[\s\S]*pgrst\.db_pre_request = 'public\.enforce_passwordless_data_api_session'/
  )
  assert.match(accessTokenHook, /notify pgrst, 'reload config'/)
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
  const authConfigAt = productionDeploy.indexOf(
    'supabase config push --project-ref "$SUPABASE_PROJECT_REF"'
  )
  const accessTokenActivationAt = productionDeploy.indexOf(
    "Activate password-token rejection before domain promotion"
  )
  const stagedCanaryAt = productionDeploy.indexOf(
    "Prove staged Auth hook signing-secret alignment"
  )
  const promoteAt = productionDeploy.indexOf(
    "Promote the verified staged deployment"
  )
  assert.ok(migrationAt > 0)
  assert.doesNotMatch(productionDatabase, /supabase config push/)
  assert.match(productionDatabase, /openssl rand -base64 32/)
  assert.match(productionDatabase, /::add-mask::/)
  assert.doesNotMatch(
    productionDatabase,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET:.*(?:secrets\.|whsec_)/
  )
  assert.ok(stagedCanaryAt > 0 && promoteAt > stagedCanaryAt)
  assert.ok(
    accessTokenActivationAt > stagedCanaryAt &&
      promoteAt > accessTokenActivationAt
  )
  assert.ok(authConfigAt > promoteAt)
  assert.match(
    productionDeploy,
    /hook_custom_access_token_enabled: true[\s\S]*hook_custom_access_token_uri: \$uri[\s\S]*--request PATCH/
  )
  assert.match(
    productionDeploy,
    /GET[\s\S]*\.hook_custom_access_token_enabled == true[\s\S]*\.hook_custom_access_token_uri == \$uri/
  )
  assert.match(
    productionDeploy,
    /Read back complete production Auth hook configuration[\s\S]*\.hook_send_email_enabled == true[\s\S]*\.hook_send_email_uri == "https:\/\/nabaperks\.com\/api\/auth\/hooks\/send-email"/
  )
  assert.match(productionDeploy, /actions: read/)
  assert.match(productionDeploy, /--workflow production-database\.yml/)
  assert.match(productionDeploy, /--commit "\$EXPECTED_REVISION"/)
  assert.match(productionDeploy, /successful_database_revision/)
  assert.match(
    productionDeploy,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET: \$\{\{ secrets\.SUPABASE_SEND_EMAIL_HOOK_SECRET \}\}/
  )
  assert.doesNotMatch(
    productionDeploy,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET:[^\n]*(?:\|\||whsec_)/
  )
})
