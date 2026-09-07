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
    /x-nabaperks-passwordless-guard-probe[\s\S]*Passwordless Data API guard is active/
  )
  assert.doesNotMatch(
    accessTokenHook,
    /alter role authenticator|pgrst\.db_pre_request/
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
  const accessTokenActivationAt = productionDeploy.indexOf(
    "Activate reviewed production Auth configuration"
  )
  const dataApiActivationAt = productionDeploy.indexOf(
    "Activate and read back the passwordless Data API guard"
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
    dataApiActivationAt > promoteAt &&
      accessTokenActivationAt > dataApiActivationAt
  )
  assert.doesNotMatch(productionDeploy, /supabase config push/)
  assert.match(
    productionDeploy,
    /alter role authenticator set pgrst\.db_pre_request = 'private\.enforce_passwordless_data_api_session'/
  )
  assert.match(
    productionDeploy,
    /database\/query[\s\S]*\.\[0\]\.pre_request == "private\.enforce_passwordless_data_api_session"/
  )
  assert.match(
    productionDeploy,
    /projects api-keys[\s\S]*service_role[\s\S]*::add-mask::[\s\S]*x-nabaperks-passwordless-guard-probe: active[\s\S]*probe_status[\s\S]*401[\s\S]*403[\s\S]*\.code == "42501"[\s\S]*Passwordless Data API guard is active/
  )
  assert.match(
    productionDeploy,
    /hook_custom_access_token_enabled: true[\s\S]*hook_custom_access_token_uri: \$uri[\s\S]*hook_send_email_enabled: true[\s\S]*hook_send_email_uri: \$send_email_uri[\s\S]*hook_send_email_secrets: env\.SUPABASE_SEND_EMAIL_HOOK_SECRET[\s\S]*--request PATCH/
  )
  assert.match(productionDeploy, /umask 077/)
  assert.match(productionDeploy, /--data-binary "@\$payload_file"/)
  assert.doesNotMatch(productionDeploy, /--arg send_email_secret\s/)
  assert.match(
    productionDeploy,
    /--arg send_email_secret_hash "\$expected_secret_hash"/
  )
  assert.doesNotMatch(
    productionDeploy,
    /--arg send_email_secret_hash "hash:\$expected_secret_hash"/
  )
  for (const disabledFactor of [
    "mfa_totp_enroll_enabled",
    "mfa_totp_verify_enabled",
    "mfa_phone_enroll_enabled",
    "mfa_phone_verify_enabled",
    "mfa_web_authn_enroll_enabled",
    "mfa_web_authn_verify_enabled",
    "passkey_enabled",
  ]) {
    assert.match(productionDeploy, new RegExp(`${disabledFactor} == false`))
  }
  assert.match(
    productionDeploy,
    /GET[\s\S]*\.hook_custom_access_token_enabled == true[\s\S]*\.hook_custom_access_token_uri == \$uri[\s\S]*\.hook_send_email_enabled == true[\s\S]*\.hook_send_email_uri == \$send_email_uri[\s\S]*\.hook_send_email_secrets == \$send_email_secret_hash/
  )
  assert.match(
    productionDeploy,
    /Read back complete production Auth hook configuration[\s\S]*\.hook_send_email_enabled == true[\s\S]*\.hook_send_email_uri == "https:\/\/nabaperks\.com\/api\/auth\/hooks\/send-email"/
  )
  assert.match(productionDeploy, /actions: read/)
  const application = productionDatabase.slice(
    productionDatabase.indexOf("\n  application:")
  )
  const protectedDatabase = productionDatabase.slice(
    productionDatabase.indexOf("\n  promote:"),
    productionDatabase.indexOf("\n  application:")
  )
  assert.match(protectedDatabase, /environment: Production/)
  assert.match(protectedDatabase, /supabase db push --linked --include-all/)
  assert.match(
    application,
    /needs: promote\s+uses: \.\/\.github\/workflows\/production-deploy\.yml/
  )
  assert.match(application, /release_run_id: \$\{\{ github\.run_id \}\}/)
  assert.match(
    application,
    /release_run_attempt: \$\{\{ github\.run_attempt \}\}/
  )
  assert.match(
    application,
    /expected_revision: \$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.head_sha \|\| inputs\.expected_revision \}\}/
  )
  assert.match(
    productionDeploy,
    /test "\$GITHUB_REPOSITORY" = "lapeninns\/nabaperks"/
  )
  assert.match(productionDeploy, /test "\$RELEASE_RUN_ID" = "\$GITHUB_RUN_ID"/)
  assert.match(
    productionDeploy,
    /test "\$RELEASE_RUN_ATTEMPT" = "\$GITHUB_RUN_ATTEMPT"/
  )
  assert.match(
    productionDeploy,
    /caller_path="\$\(gh api "repos\/\$GITHUB_REPOSITORY\/actions\/runs\/\$GITHUB_RUN_ID" --jq '\.path'\)"/
  )
  assert.match(
    productionDeploy,
    /test "\$caller_path" = "\.github\/workflows\/production-database\.yml"/
  )
  assert.match(
    productionDeploy,
    /test "\$SOURCE_REVISION" = "\$EXPECTED_REVISION"/
  )
  assert.match(productionDeploy, /test "\$EXPECTED_REVISION" = "\$GITHUB_SHA"/)
  assert.match(
    productionDeploy,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET: \$\{\{ secrets\.SUPABASE_SEND_EMAIL_HOOK_SECRET \}\}/
  )
  assert.doesNotMatch(
    productionDeploy,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET:[^\n]*(?:\|\||whsec_)/
  )
})
