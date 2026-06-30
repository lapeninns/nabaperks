import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  loadProjectEnv,
  resolveSupabaseDbUrl,
} from "../../scripts/provider-readiness/runtime.mjs"
import {
  diffMigrationVersions,
  parseRemoteMigrationVersions,
} from "../../scripts/check-supabase-migrations.mjs"

const packageJson = JSON.parse(readFileSync("package.json", "utf8"))
const smokeScript = [
  "scripts/check-provider-readiness.mjs",
  "scripts/provider-readiness/runtime.mjs",
  "scripts/provider-readiness/checks.mjs",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n")
const supabaseMigrationScript = readFileSync(
  "scripts/check-supabase-migrations.mjs",
  "utf8"
)
const envCheckScript = readFileSync("scripts/check-env.mjs", "utf8")
const remediationLog = readFileSync(
  "docs/architecture-flows/11-remediation-log.md",
  "utf8"
)

test("provider readiness smoke command is wired into package scripts", () => {
  assert.equal(
    packageJson.scripts["smoke:providers"],
    "node scripts/check-provider-readiness.mjs"
  )
  assert.equal(
    packageJson.scripts["env:check:production"],
    "node scripts/check-env.mjs --profile=production"
  )
  assert.equal(
    packageJson.scripts["smoke:supabase:migrations"],
    "node scripts/check-supabase-migrations.mjs"
  )
})

test("provider readiness smoke remains read-only by default", () => {
  assert.match(smokeScript, /read-only smoke did not replay Stripe events/)
  assert.match(smokeScript, /read-only smoke did not send a test OTP/)
  assert.match(smokeScript, /read-only smoke did not send a test email/)
  assert.match(smokeScript, /read-only smoke did not deliver a Web Push message/)
  assert.doesNotMatch(smokeScript, /method:\s*["']POST["']/)
  assert.doesNotMatch(smokeScript, /\/Messages\.json/)
  assert.doesNotMatch(smokeScript, /\/capture\//)
  assert.doesNotMatch(smokeScript, /stripe trigger/)
})

test("provider readiness smoke covers the remaining release gates", () => {
  for (const gate of [
    "supabase-rpcs",
    "stripe-webhook-replay",
    "twilio-verify-service",
    "resend-api",
    "vercel-cron-secret",
    "supabase-email-hook-secret",
    "web-push-vapid",
    "posthog-capture",
  ]) {
    assert.match(smokeScript, new RegExp(gate))
  }
})

test("Supabase migration smoke stays read-only", () => {
  assert.match(supabaseMigrationScript, /"migration", "list", "--linked"/)
  assert.doesNotMatch(supabaseMigrationScript, /db push/)
  assert.doesNotMatch(supabaseMigrationScript, /migration repair/)
  assert.doesNotMatch(supabaseMigrationScript, /--apply/)
})

test("Supabase migration smoke detects local and remote drift", () => {
  const output = `
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260606142000 | 20260606142000 | 2026-06-06 14:20:00
   20260630120000 |                | 2026-06-30 12:00:00
                  | 20260630130000 | 2026-06-30 13:00:00
`
  const remoteVersions = parseRemoteMigrationVersions(output)
  const diff = diffMigrationVersions(
    ["20260606142000", "20260630120000"],
    remoteVersions
  )

  assert.deepEqual(remoteVersions, ["20260606142000", "20260630130000"])
  assert.deepEqual(diff.missingOnRemote, ["20260630120000"])
  assert.deepEqual(diff.extraOnRemote, ["20260630130000"])
})

test("provider readiness can derive hosted Supabase DB URL from linked pooler metadata", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "nabaperks-provider-"))

  try {
    mkdirSync(join(projectDir, "supabase", ".temp"), { recursive: true })
    writeFileSync(join(projectDir, ".env"), "SUPABASE_DB_PASSWORD=secret123\n")
    writeFileSync(
      join(projectDir, "supabase", ".temp", "pooler-url"),
      "postgres://postgres.project:placeholder@aws-0-eu-west-2.pooler.supabase.com:6543/postgres\n"
    )

    const env = loadProjectEnv(projectDir)
    const url = new URL(env.SUPABASE_DB_URL)

    assert.equal(url.hostname, "aws-0-eu-west-2.pooler.supabase.com")
    assert.equal(url.password, "secret123")
    assert.equal(url.pathname, "/postgres")
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

test("provider readiness keeps explicit Supabase DB URL authoritative", () => {
  const explicitUrl = "postgres://postgres:postgres@127.0.0.1:54322/postgres"
  const resolvedUrl = resolveSupabaseDbUrl(process.cwd(), {
    SUPABASE_DB_PASSWORD: "secret123",
    SUPABASE_DB_URL: explicitUrl,
  })

  assert.equal(resolvedUrl, explicitUrl)
})

test("production env check requires provider release secrets", () => {
  assert.match(envCheckScript, /productionRequiredEnvNames/)

  for (const key of [
    "CRON_SECRET",
    "NEXT_PUBLIC_POSTHOG_HOST",
    "NEXT_PUBLIC_POSTHOG_KEY",
    "RESEND_FROM",
    "SUPABASE_SEND_EMAIL_HOOK_SECRET",
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "WEB_PUSH_VAPID_SUBJECT",
  ]) {
    assert.match(envCheckScript, new RegExp(`"${key}"`))
  }
})

test("remediation log points release verification at the provider smoke command", () => {
  assert.match(remediationLog, /pnpm smoke:providers/)
  assert.match(remediationLog, /pnpm smoke:supabase:migrations/)
  assert.match(remediationLog, /pnpm env:check:production/)
})
