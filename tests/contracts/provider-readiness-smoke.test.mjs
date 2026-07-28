import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createECDH } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  createReport,
  loadProjectEnv,
  resolveSupabaseDbUrl,
} from "../../scripts/provider-readiness/runtime.mjs"
import {
  checkStripe,
  runReadinessChecks,
} from "../../scripts/provider-readiness/checks.mjs"
import { serializeEnvValue } from "../../scripts/env-file.mjs"
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
const envKeysScript = readFileSync("scripts/env-keys.mjs", "utf8")
const envContract = JSON.parse(readFileSync("config/env-contract.json", "utf8"))
const remediationLog = readFileSync(
  "docs/architecture-flows/11-remediation-log.md",
  "utf8"
)
const highEntropyTestEnvNames = new Set([
  "ANALYTICS_PSEUDONYM_SECRET",
  "CRON_SECRET",
  "PRODUCTION_MONITOR_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "CUSTOMER_PHONE_HMAC_SECRET",
  "CUSTOMER_PHONE_ENCRYPTION_KEY",
  "CUSTOMER_EMAIL_HMAC_SECRET",
  "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY",
  "SUPABASE_SEND_EMAIL_HOOK_SECRET",
  "SUPABASE_SEND_SMS_HOOK_SECRET",
])
const validVapidTestValues = createValidVapidTestValues()

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
  assert.match(
    smokeScript,
    /read-only smoke did not deliver a Web Push message/
  )
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
    "posthog-config",
    "posthog-capture",
  ]) {
    assert.match(smokeScript, new RegExp(gate))
  }
})

test("provider readiness makes both Growth billing intervals explicit", () => {
  for (const key of [
    "STRIPE_GROWTH_PRICE_ID",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID",
  ]) {
    assert.match(smokeScript, new RegExp(key))
  }

  assert.match(smokeScript, /test-mode GBP 49\/month/i)
  assert.match(smokeScript, /test-mode GBP 490\/year/i)
  assert.match(smokeScript, /body\.livemode === false/)
})

test("provider readiness rejects non-test Stripe keys before provider reads", async () => {
  const report = createReport()
  let providerReads = 0

  await checkStripe({
    env: stripeReadinessEnvironment({
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_forbidden",
      STRIPE_SECRET_KEY: "sk_live_forbidden",
    }),
    offline: false,
    report,
    getJsonRequest: async () => {
      providerReads += 1
      throw new Error("must not read Stripe with live credentials")
    },
  })

  assert.equal(providerReads, 0)
  assert.equal(resultFor(report, "stripe-api").status, "FAIL")
  assert.equal(resultFor(report, "stripe-publishable-key").status, "FAIL")
})

test("provider readiness requires both recurring Prices to be test-mode objects", async () => {
  for (const livemode of [false, true]) {
    const report = createReport()

    await checkStripe({
      env: stripeReadinessEnvironment(),
      offline: false,
      report,
      getJsonRequest: async (url) => {
        const annual = url.includes("price_annual")
        return {
          ok: true,
          status: 200,
          body: {
            active: true,
            currency: "gbp",
            id: annual ? "price_annual" : "price_monthly",
            livemode,
            recurring: { interval: annual ? "year" : "month" },
            unit_amount: annual ? 49_000 : 4_900,
          },
        }
      },
    })

    assert.equal(
      resultFor(report, "stripe-price-monthly").status,
      livemode ? "FAIL" : "PASS"
    )
    assert.equal(
      resultFor(report, "stripe-price-annual").status,
      livemode ? "FAIL" : "PASS"
    )
  }
})

test("Supabase migration smoke stays read-only", () => {
  assert.match(supabaseMigrationScript, /migrationTarget = "--linked"/)
  assert.match(supabaseMigrationScript, /"migration", "list", migrationTarget/)
  assert.match(supabaseMigrationScript, /migrationTarget !== "--local"/)
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
  const inheritedDbUrl = process.env.SUPABASE_DB_URL

  try {
    delete process.env.SUPABASE_DB_URL
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
    if (inheritedDbUrl === undefined) {
      delete process.env.SUPABASE_DB_URL
    } else {
      process.env.SUPABASE_DB_URL = inheritedDbUrl
    }
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

test("production env check requires provider release secrets without forcing optional external analytics", () => {
  assert.match(envCheckScript, /productionRequiredEnvNames/)

  for (const key of [
    "CRON_SECRET",
    "RESEND_FROM",
    "SUPABASE_SEND_EMAIL_HOOK_SECRET",
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "WEB_PUSH_VAPID_SUBJECT",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID",
  ]) {
    assert.match(envCheckScript, new RegExp(`"${key}"`))
  }

  const productionRequiredBlock = envCheckScript.match(
    /const productionRequiredEnvNames = new Set\(\[([\s\S]*?)\]\)/
  )
  assert.ok(productionRequiredBlock)
  assert.doesNotMatch(productionRequiredBlock[1], /POSTHOG|ANALYTICS/)
})

test("external analytics env becomes mandatory only in exact pseudonymous mode", () => {
  for (const key of [
    "ANALYTICS_EXTERNAL_PROCESSING_MODE",
    "POSTHOG_PROJECT_KEY",
    "POSTHOG_HOST",
    "ANALYTICS_PSEUDONYM_SECRET",
  ]) {
    assert.match(envCheckScript, new RegExp(key))
    assert.match(smokeScript, new RegExp(key))
  }

  assert.match(
    envCheckScript,
    /const pseudonymousAnalyticsMode\s*=\s*["']pseudonymous["']/
  )
  assert.match(
    envCheckScript,
    /ANALYTICS_EXTERNAL_PROCESSING_MODE\s*===\s*pseudonymousAnalyticsMode/
  )
  assert.match(smokeScript, /!==\s*["']pseudonymous["']/)
  assert.match(smokeScript, /external processing is intentionally disabled/i)
  assert.match(
    smokeScript,
    /server-side pseudonymous analytics config is present/i
  )
  assert.doesNotMatch(smokeScript, /NEXT_PUBLIC_POSTHOG/)
})

test("provider readiness accepts exactly the runtime PostHog project-key contract", async () => {
  const boundaryKey = `phc_${"a".repeat(252)}`
  assert.equal(boundaryKey.length, 256)

  for (const projectKey of ["phc_project_123-ABC", boundaryKey]) {
    const result = await postHogConfigResult(projectKey)
    assert.equal(result.status, "PASS", result.message)
  }

  for (const projectKey of [
    "phc_bad!",
    "phc_bad key",
    " phc_leading_space",
    "phc_trailing_space ",
    `phc_${"a".repeat(253)}`,
  ]) {
    const result = await postHogConfigResult(projectKey)
    assert.equal(
      result.status,
      "FAIL",
      `provider readiness must reject runtime-disabled key ${JSON.stringify(projectKey)}`
    )
  }
})

test("production env validation executes with analytics off and fails closed for incomplete pseudonymous mode", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "nabaperks-env-check-"))
  const analyticsNames = new Set([
    "ANALYTICS_EXTERNAL_PROCESSING_MODE",
    "POSTHOG_PROJECT_KEY",
    "POSTHOG_HOST",
    "ANALYTICS_PSEUDONYM_SECRET",
  ])
  const baseValues = Object.fromEntries(
    envContract
      .filter(
        (entry) =>
          !analyticsNames.has(entry.name) &&
          entry.name !== "CUSTOMER_OTP_BYPASS_MODE"
      )
      .map((entry) => [entry.name, validTestEnvValue(entry)])
  )
  baseValues.CRON_SECRET = "N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?x"
  baseValues.PRODUCTION_MONITOR_SECRET = "P4@wS8#nC2!kV6$rJ9^tB3&yM7*zQ5?e"

  try {
    mkdirSync(join(projectDir, "config"), { recursive: true })
    writeFileSync(
      join(projectDir, "config", "env-contract.json"),
      JSON.stringify(envContract)
    )

    const disabled = runProductionEnvCheck(projectDir, baseValues)
    assert.equal(disabled.status, 0, disabled.stderr)

    const nonExact = runProductionEnvCheck(projectDir, {
      ...baseValues,
      ANALYTICS_EXTERNAL_PROCESSING_MODE: '" pseudonymous"',
    })
    assert.equal(nonExact.status, 0, nonExact.stderr)

    const incomplete = runProductionEnvCheck(projectDir, {
      ...baseValues,
      ANALYTICS_EXTERNAL_PROCESSING_MODE: "pseudonymous",
    })
    assert.equal(incomplete.status, 1)
    assert.match(incomplete.stderr, /POSTHOG_PROJECT_KEY/)
    assert.match(incomplete.stderr, /POSTHOG_HOST/)
    assert.match(incomplete.stderr, /ANALYTICS_PSEUDONYM_SECRET/)

    const complete = runProductionEnvCheck(projectDir, {
      ...baseValues,
      ANALYTICS_EXTERNAL_PROCESSING_MODE: "pseudonymous",
      POSTHOG_PROJECT_KEY: "phc_test_project",
      POSTHOG_HOST: "https://eu.i.posthog.com",
      ANALYTICS_PSEUDONYM_SECRET: "H7!qM2@vR9#cT4$yK6^pD3&zF8*wN5?x",
    })
    assert.equal(complete.status, 0, complete.stderr)

    for (const invalidHost of [
      "http://analytics.example.com",
      "https://user:pass@eu.i.posthog.com",
      "https://eu.i.posthog.com/capture?raw=true",
    ]) {
      const invalidHostResult = runProductionEnvCheck(projectDir, {
        ...baseValues,
        ANALYTICS_EXTERNAL_PROCESSING_MODE: "pseudonymous",
        POSTHOG_PROJECT_KEY: "phc_test_project",
        POSTHOG_HOST: invalidHost,
        ANALYTICS_PSEUDONYM_SECRET: "H7!qM2@vR9#cT4$yK6^pD3&zF8*wN5?x",
      })
      assert.equal(invalidHostResult.status, 1)
      assert.match(invalidHostResult.stderr, /POSTHOG_HOST/)
    }
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

test("PostHog env helper writes only server-side pseudonymous settings without printing values", () => {
  const setPostHogStart = envKeysScript.indexOf("function setPostHog()")
  const setPostHogEnd = envKeysScript.indexOf(
    "function pushVercelEnv()",
    setPostHogStart
  )
  assert.notEqual(setPostHogStart, -1)
  assert.notEqual(setPostHogEnd, -1)
  const setPostHogSource = envKeysScript.slice(setPostHogStart, setPostHogEnd)

  for (const key of [
    "ANALYTICS_EXTERNAL_PROCESSING_MODE",
    "POSTHOG_PROJECT_KEY",
    "POSTHOG_HOST",
    "ANALYTICS_PSEUDONYM_SECRET",
  ]) {
    assert.match(setPostHogSource, new RegExp(key))
  }

  assert.match(envKeysScript, /server-side pseudonymous PostHog/i)
  assert.match(envKeysScript, /without printing secrets/i)
  assert.doesNotMatch(envKeysScript, /NEXT_PUBLIC_POSTHOG/)
  assert.doesNotMatch(
    setPostHogSource,
    /console\.(?:log|error)\([^)]*(?:postHogKey|postHogHost|pseudonymSecret)/
  )
})

test("remediation log points release verification at the provider smoke command", () => {
  assert.match(remediationLog, /pnpm smoke:providers/)
  assert.match(remediationLog, /pnpm smoke:supabase:migrations/)
  assert.match(remediationLog, /pnpm env:check:production/)
})

function validTestEnvValue(entry) {
  if (entry.name in validVapidTestValues) {
    return validVapidTestValues[entry.name]
  }
  if (entry.name === "NEXT_PUBLIC_SUPABASE_URL") {
    return "https://ci.supabase.co"
  }
  if (entry.name === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") {
    return "pk_test_provider_readiness"
  }
  if (entry.name === "STRIPE_SECRET_KEY") {
    return "sk_test_provider_readiness"
  }
  if (entry.kind === "url") return "https://example.com"
  if (entry.kind === "postgres-url") {
    return "postgres://user:password@example.com/database"
  }
  if (
    entry.name === "SUPABASE_SEND_EMAIL_HOOK_SECRET" ||
    entry.name === "SUPABASE_SEND_SMS_HOOK_SECRET"
  ) {
    return [
      "v1,wh",
      "sec_",
      "SDkhbVEyQHZSNyNjVDQkeUs4XnBEMyZ6RjYqd041P3g=",
    ].join("")
  }
  if (highEntropyTestEnvNames.has(entry.name)) {
    return `H9!mD4@qL7#vR2$tK8^xC5&pN3*zW6?${entry.name.length}`
  }

  return "test-value-at-least-32-characters-long"
}

function createValidVapidTestValues() {
  const curve = createECDH("prime256v1")
  curve.generateKeys()
  const privateKey = leftPadPrivateKey(curve.getPrivateKey())

  return {
    WEB_PUSH_VAPID_PRIVATE_KEY: privateKey.toString("base64url"),
    WEB_PUSH_VAPID_PUBLIC_KEY: curve.getPublicKey().toString("base64url"),
    WEB_PUSH_VAPID_SUBJECT: "mailto:hello@example.test",
  }
}

function leftPadPrivateKey(value) {
  if (value.length >= 32) return value
  return Buffer.concat([Buffer.alloc(32 - value.length), value])
}

async function postHogConfigResult(projectKey) {
  const report = createReport()
  await runReadinessChecks({
    env: {
      ANALYTICS_EXTERNAL_PROCESSING_MODE: "pseudonymous",
      ANALYTICS_PSEUDONYM_SECRET:
        "readiness-test-secret-at-least-32-characters",
      POSTHOG_HOST: "https://eu.i.posthog.com",
      POSTHOG_PROJECT_KEY: projectKey,
    },
    offline: true,
    report,
  })

  const result = report.results.find(({ gate }) => gate === "posthog-config")
  assert.ok(result, "PostHog readiness emits a configuration result")
  return result
}

function stripeReadinessEnvironment(overrides = {}) {
  return {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_readiness",
    STRIPE_GROWTH_ANNUAL_PRICE_ID: "price_annual",
    STRIPE_GROWTH_PRICE_ID: "price_monthly",
    STRIPE_SECRET_KEY: "sk_test_readiness",
    STRIPE_WEBHOOK_SECRET: "whsec_readiness",
    ...overrides,
  }
}

function resultFor(report, gate) {
  const result = report.results.find((candidate) => candidate.gate === gate)
  assert.ok(result, `${gate} result is present`)
  return result
}

function runProductionEnvCheck(projectDir, values) {
  writeFileSync(
    join(projectDir, ".env"),
    `${Object.entries(values)
      .map(([name, value]) => `${name}=${serializeEnvValue(value)}`)
      .join("\n")}\n`
  )

  return spawnSync(
    process.execPath,
    [join(process.cwd(), "scripts", "check-env.mjs"), "--profile=production"],
    {
      cwd: projectDir,
      encoding: "utf8",
      env: { NODE_ENV: "test", PATH: process.env.PATH ?? "" },
    }
  )
}
