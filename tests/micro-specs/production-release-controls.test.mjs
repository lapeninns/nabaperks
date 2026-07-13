import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

const projectDir = process.cwd()
const checkEnvScript = resolve(projectDir, "scripts/check-env.mjs")
const envContract = JSON.parse(
  readFileSync(join(projectDir, "config/env-contract.json"), "utf8")
)

test("Given a hosted production build When no CLI profile is supplied Then production-only environment keys are required", () => {
  const result = runEnvCheck({ vercelEnv: "production" })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Missing: .*CRON_SECRET/)
  assert.match(result.stderr, /WEB_PUSH_VAPID_PRIVATE_KEY/)
})

test("Given an explicit default profile When Vercel reports production Then explicit CLI intent remains authoritative", () => {
  const result = runEnvCheck({
    args: ["--profile=default"],
    vercelEnv: "production",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /environment configuration is valid/)
})

test("Given a complete production configuration When generated credentials are supplied Then the environment succeeds", () => {
  const result = runEnvCheck({
    args: ["--profile=production"],
    environment: {
      CRON_SECRET: "N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?x",
      PRODUCTION_MONITOR_SECRET: "P4@wS8#nC2!kV6$rJ9^tB3&yM7*zQ5?e",
      RESEND_FROM: "Nabaperks <hello@example.test>",
      STRIPE_GROWTH_ANNUAL_PRICE_ID: "price_annual_fixture",
      SUPABASE_SEND_EMAIL_HOOK_SECRET:
        "v1,whsec_TmFiYVBlcmtzUHJvZHVjdGlvbkhvb2tLZXkyMDI2IQ==",
      WEB_PUSH_VAPID_PRIVATE_KEY: "fixture-private-key",
      WEB_PUSH_VAPID_PUBLIC_KEY: "fixture-public-key",
      WEB_PUSH_VAPID_SUBJECT: "mailto:hello@example.test",
    },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /production environment configuration is valid/)
})

test("Given hosted configuration When the Supabase origin is untrusted Then privileged readiness cannot deploy", () => {
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.co.evil.example",
    },
    vercelEnv: "production",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project origin/
  )
})

for (const name of [
  "CRON_SECRET",
  "PRODUCTION_MONITOR_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "CUSTOMER_PHONE_HMAC_SECRET",
  "CUSTOMER_PHONE_ENCRYPTION_KEY",
  "SUPABASE_SEND_EMAIL_HOOK_SECRET",
  "SUPABASE_SEND_SMS_HOOK_SECRET",
]) {
  test(`Given hosted configuration When ${name} is weak Then the environment fails closed`, () => {
    const result = runEnvCheck({
      args: ["--profile=default"],
      environment: { [name]: "x" },
      vercelEnv: "production",
    })

    assert.equal(result.status, 1)
    assert.match(
      result.stderr,
      new RegExp(`${name} must be at least 32 characters`)
    )
  })
}

test("Given hosted configuration When a protected secret has low diversity Then the environment fails closed", () => {
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: { CUSTOMER_SESSION_SECRET: "a".repeat(32) },
    vercelEnv: "production",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /CUSTOMER_SESSION_SECRET must use a generated high-entropy value/
  )
})

test("Given hosted configuration When a protected secret uses an obvious deterministic sequence Then the environment fails closed", () => {
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      SUPABASE_SEND_EMAIL_HOOK_SECRET: "Abcdef0123456789-Abcdef0123456789!",
    },
    vercelEnv: "production",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET must use a generated high-entropy value/
  )
})

test("Given hosted configuration When monitor and cron credentials are reused Then the environment fails closed", () => {
  const sharedSecret = "shared-monitor-cron-0123456789-ABCDEF"
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      CRON_SECRET: sharedSecret,
      PRODUCTION_MONITOR_SECRET: sharedSecret,
    },
    vercelEnv: "production",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /PRODUCTION_MONITOR_SECRET must differ from CRON_SECRET/
  )
})

for (const [name, value, message] of [
  [
    "CUSTOMER_OTP_BYPASS_MODE",
    "any-4-digits",
    "CUSTOMER_OTP_BYPASS_MODE must be blank outside local development",
  ],
  [
    "CUSTOMER_DEV_OTP_CODE",
    "424242",
    "CUSTOMER_DEV_OTP_CODE must be blank outside local development",
  ],
]) {
  test(`Given hosted preview When ${name} is configured Then the environment check fails closed`, () => {
    const result = runEnvCheck({
      environment: { [name]: value },
      vercelEnv: "preview",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, new RegExp(message))
  })
}

test("Given hosted release configuration When release controls are inspected Then environment validation precedes every build", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"))
  const ci = readFileSync(".github/workflows/ci.yml", "utf8")
  const envCheckIndex = ci.indexOf("- run: pnpm env:check:production")
  const lintIndex = ci.indexOf("- run: pnpm lint")

  assert.equal(vercel.buildCommand, "pnpm env:check && pnpm build")
  assert.notEqual(envCheckIndex, -1)
  assert.notEqual(lintIndex, -1)
  assert.ok(
    envCheckIndex < lintIndex,
    "CI must validate the environment before repository gates"
  )
  assert.match(ci, /- run: pnpm security:audit/)
  assert.match(
    ci,
    /--project=chromium --project=mobile-safari --project=desktop-firefox --project=desktop-safari --grep-invert @visual/
  )
})

function runEnvCheck({ args = [], environment = {}, vercelEnv }) {
  const fixtureDir = mkdtempSync(join(tmpdir(), "nabaperks-release-env-"))

  try {
    const configDir = join(fixtureDir, "config")
    cpSync(join(projectDir, "config"), configDir, { recursive: true })
    writeFileSync(join(fixtureDir, ".env"), baseEnvironmentFile())

    return spawnSync(process.execPath, [checkEnvScript, ...args], {
      cwd: fixtureDir,
      encoding: "utf8",
      env: {
        HOME: process.env.HOME ?? "",
        NODE_ENV: "test",
        PATH: process.env.PATH ?? "",
        VERCEL_ENV: vercelEnv,
        ...environment,
      },
    })
  } finally {
    rmSync(fixtureDir, { force: true, recursive: true })
  }
}

function baseEnvironmentFile() {
  const values = envContract
    .filter((entry) => !entry.optional)
    .map((entry) => `${entry.name}=${testValue(entry)}`)

  values.push("TWILIO_AUTH_TOKEN=test-auth-token")
  return `${values.join("\n")}\n`
}

function testValue(entry) {
  if (entry.name === "NEXT_PUBLIC_SUPABASE_URL") {
    return "https://ci.supabase.co"
  }
  if (entry.kind === "url") return "https://example.test"
  if (
    [
      "CRON_SECRET",
      "PRODUCTION_MONITOR_SECRET",
      "CUSTOMER_SESSION_SECRET",
      "CUSTOMER_PHONE_HMAC_SECRET",
      "CUSTOMER_EMAIL_HMAC_SECRET",
      "CUSTOMER_PHONE_ENCRYPTION_KEY",
      "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY",
    ].includes(entry.name)
  ) {
    return `N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?${entry.name.length}`
  }
  return `fixture-${entry.name.toLowerCase()}-0123456789abcdef`
}
