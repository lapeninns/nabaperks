import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveConfig } from "../../scripts/check-staging-release.mjs"

const PROJECT_REF = "abcdefghijklmnopqrst"

function validEnv(overrides = {}) {
  return {
    STAGING_APP_URL: "https://nabaperks-staging-proof.vercel.app",
    STAGING_EXPECTED_REVISION: "a".repeat(40),
    STAGING_MONITOR_SECRET: "monitor-secret",
    STAGING_RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from("a".repeat(32)).toString("base64")}`,
    STAGING_RUN_ID: "123-1",
    STAGING_STRIPE_WEBHOOK_SECRET: "whsec_staging_123",
    STAGING_SUPABASE_DB_URL: `postgresql://postgres.${PROJECT_REF}:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
    STAGING_SUPABASE_PROJECT_REF: PROJECT_REF,
    STAGING_VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
    ...overrides,
  }
}

test("staging release config accepts isolated immutable targets", () => {
  const config = resolveConfig(validEnv())

  assert.equal(config.appUrl.hostname, "nabaperks-staging-proof.vercel.app")
  assert.equal(config.projectRef, PROJECT_REF)
  assert.equal(config.revision, "a".repeat(40))
})

test("staging release config rejects local or mismatched databases", () => {
  assert.throws(
    () =>
      resolveConfig(
        validEnv({
          STAGING_SUPABASE_DB_URL:
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        })
      ),
    /must not be local/
  )

  assert.throws(
    () =>
      resolveConfig(
        validEnv({
          STAGING_SUPABASE_DB_URL:
            "postgresql://postgres.differentprojectref:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres",
        })
      ),
    /must identify the configured staging project ref/
  )
})

test("staging release config rejects mutable or malformed application targets", () => {
  for (const appUrl of [
    "http://nabaperks-staging-proof.vercel.app",
    "https://nabaperks-staging-proof.vercel.app/path",
    "https://nabaperks.com",
  ]) {
    assert.throws(() => resolveConfig(validEnv({ STAGING_APP_URL: appUrl })))
  }
})
