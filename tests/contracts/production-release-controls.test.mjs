import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createECDH } from "node:crypto"
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

import { serializeEnvValue } from "../../scripts/env-file.mjs"

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
      SUPABASE_SEND_EMAIL_HOOK_SECRET: [
        "v1,wh",
        "sec_",
        "SDkhbVEyQHZSNyNjVDQkeUs4XnBEMyZ6RjYqd041P3g=",
      ].join(""),
      ...validVapidEnvironment(),
    },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /production environment configuration is valid/)
})

test("Given a monitor-secret overlap When the next token is reused Then production validation fails closed", () => {
  const sharedSecret = "P4@wS8#nC2!kV6$rJ9^tB3&yM7*zQ5?e"
  const result = runEnvCheck({
    args: ["--profile=production"],
    environment: {
      CRON_SECRET: "N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?x",
      PRODUCTION_MONITOR_SECRET: sharedSecret,
      PRODUCTION_MONITOR_SECRET_NEXT: sharedSecret,
      RESEND_FROM: "Nabaperks <hello@example.test>",
      SUPABASE_SEND_EMAIL_HOOK_SECRET: [
        "v1,wh",
        "sec_",
        "SDkhbVEyQHZSNyNjVDQkeUs4XnBEMyZ6RjYqd041P3g=",
      ].join(""),
      ...validVapidEnvironment(),
    },
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /PRODUCTION_MONITOR_SECRET_NEXT must differ from PRODUCTION_MONITOR_SECRET/
  )
  assert.doesNotMatch(result.stderr, new RegExp(escapeRegExp(sharedSecret)))
})

for (const [name, malformed, message] of [
  [
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    "fixture-private-key",
    "WEB_PUSH_VAPID_PRIVATE_KEY must be an unpadded URL-safe Base64 value decoding to 32 bytes",
  ],
  [
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "fixture-public-key",
    "WEB_PUSH_VAPID_PUBLIC_KEY must be an unpadded URL-safe Base64 value decoding to 65 bytes",
  ],
  [
    "WEB_PUSH_VAPID_SUBJECT",
    "http://push.example.test",
    "WEB_PUSH_VAPID_SUBJECT must be an HTTPS URL or mailto URI",
  ],
]) {
  test(`Given hosted configuration When ${name} is malformed Then deployment fails without echoing the value`, () => {
    const result = runEnvCheck({
      args: ["--profile=default"],
      environment: {
        ...validVapidEnvironment(),
        [name]: malformed,
      },
      vercelEnv: "preview",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, new RegExp(message))
    assert.doesNotMatch(
      result.stderr,
      new RegExp(malformed.replaceAll(".", "\\."))
    )
  })
}

test("Given hosted configuration When only part of the VAPID trio is configured Then deployment fails", () => {
  const { WEB_PUSH_VAPID_PUBLIC_KEY } = validVapidEnvironment()
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: { WEB_PUSH_VAPID_PUBLIC_KEY },
    vercelEnv: "preview",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /Web Push VAPID values must be configured together/
  )
})

test("Given hosted configuration When the VAPID private key is an invalid exact-length scalar Then deployment fails", () => {
  const invalidPrivateKey = Buffer.alloc(32).toString("base64url")
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      ...validVapidEnvironment(),
      WEB_PUSH_VAPID_PRIVATE_KEY: invalidPrivateKey,
    },
    vercelEnv: "preview",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /WEB_PUSH_VAPID_PRIVATE_KEY must be a valid P-256 scalar/
  )
  assert.doesNotMatch(
    result.stderr,
    new RegExp(escapeRegExp(invalidPrivateKey))
  )
})

test("Given hosted configuration When the VAPID public key is an invalid exact-length point Then deployment fails", () => {
  const invalidPublicKeyBytes = Buffer.alloc(65)
  invalidPublicKeyBytes[0] = 4
  const invalidPublicKey = invalidPublicKeyBytes.toString("base64url")
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      ...validVapidEnvironment(),
      WEB_PUSH_VAPID_PUBLIC_KEY: invalidPublicKey,
    },
    vercelEnv: "preview",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /WEB_PUSH_VAPID_PUBLIC_KEY must be a valid P-256 point/
  )
  assert.doesNotMatch(result.stderr, new RegExp(escapeRegExp(invalidPublicKey)))
})

test("Given hosted configuration When valid VAPID keys belong to different pairs Then deployment fails", () => {
  const privatePair = validVapidEnvironment()
  const publicPair = validVapidEnvironment()
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      ...privatePair,
      WEB_PUSH_VAPID_PUBLIC_KEY: publicPair.WEB_PUSH_VAPID_PUBLIC_KEY,
    },
    vercelEnv: "preview",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /WEB_PUSH_VAPID_PUBLIC_KEY must match WEB_PUSH_VAPID_PRIVATE_KEY/
  )
})

test("Given local development When Web Push is not configured Then the optional provider remains valid", () => {
  const result = runEnvCheck({ args: ["--profile=default"] })

  assert.equal(result.status, 0, result.stderr)
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
  "ANALYTICS_PSEUDONYM_SECRET",
  "CRON_SECRET",
  "PRODUCTION_MONITOR_SECRET",
  "PRODUCTION_MONITOR_SECRET_NEXT",
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

test("Given hosted configuration When a protected secret repeats a structured sequence Then the environment fails closed", () => {
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      CUSTOMER_SESSION_SECRET: "Aa1!Bb2@Cc3#Dd4$Ee5%Ff6^Gg7&Hh8*",
    },
    vercelEnv: "production",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /CUSTOMER_SESSION_SECRET must use a generated high-entropy value/
  )
})

for (const [encoding, secret] of [
  ["hex", "b9cc0956add0fb3222e43218ec49113d65b8167f96446300486009602ba3a7f5"],
  ["base64url", "YPiBzVAZkKxuPz-9CSqFcTZvdb6Rl9vtLf40-dGL1pw"],
]) {
  test(`Given hosted configuration When a protected secret uses secure ${encoding} encoding Then the environment accepts it`, () => {
    const result = runEnvCheck({
      args: ["--profile=default"],
      environment: { CUSTOMER_SESSION_SECRET: secret },
      vercelEnv: "production",
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /environment configuration is valid/)
  })
}

test("Given hosted configuration When an auth-hook secret is not Standard Webhooks formatted Then the environment fails closed", () => {
  const result = runEnvCheck({
    args: ["--profile=default"],
    environment: {
      SUPABASE_SEND_EMAIL_HOOK_SECRET: "H9!mQ2@vR7#cT4$yK8^pD3&zF6*wN5?x",
    },
    vercelEnv: "production",
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /SUPABASE_SEND_EMAIL_HOOK_SECRET must use Standard Webhooks/
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

test("Given hosted release configuration When release controls are inspected Then environment validation precedes repository checks", () => {
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
})

test("Given the CI build job When VAPID fixtures are configured Then a generator runs before production validation", () => {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8")
  const generatorIndex = ci.indexOf(
    'node scripts/generate-ci-vapid-env.mjs >> "$GITHUB_ENV"'
  )
  const envCheckIndex = ci.indexOf("- run: pnpm env:check:production")

  assert.doesNotMatch(ci, /ci-vapid-(?:public|private)-key/)
  assert.notEqual(
    generatorIndex,
    -1,
    "CI must generate an ephemeral VAPID pair"
  )
  assert.ok(
    generatorIndex < envCheckIndex,
    "CI must generate VAPID values before production validation"
  )
})

test("Given the CI VAPID generator When its output is validated Then it emits one accepted matching trio", () => {
  const generated = spawnSync(
    process.execPath,
    [resolve(projectDir, "scripts/generate-ci-vapid-env.mjs")],
    { cwd: projectDir, encoding: "utf8" }
  )

  assert.equal(generated.status, 0, generated.stderr)
  assert.equal(generated.stderr, "")

  const environment = Object.fromEntries(
    generated.stdout
      .trim()
      .split("\n")
      .map((line) => line.split(/=(.*)/s).slice(0, 2))
  )
  assert.deepEqual(Object.keys(environment).sort(), [
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "WEB_PUSH_VAPID_SUBJECT",
  ])

  const validated = runEnvCheck({
    args: ["--profile=default"],
    environment,
    vercelEnv: "preview",
  })

  assert.equal(validated.status, 0, validated.stderr)
})

test("Given a 31-byte private scalar When CI fixture padding is applied Then its value is preserved at 32 bytes", async () => {
  const { leftPadPrivateKey: padCiPrivateKey } =
    await import("../../scripts/generate-ci-vapid-env.mjs")
  const scalar = Buffer.alloc(31, 7)
  const padded = padCiPrivateKey(scalar)

  assert.equal(padded.length, 32)
  assert.equal(padded[0], 0)
  assert.deepEqual(padded.subarray(1), scalar)
})

test("Given scheduled production monitoring When a rollback is active Then probes do not require default-branch HEAD", () => {
  const workflow = readFileSync(
    ".github/workflows/production-smoke.yml",
    "utf8"
  )

  assert.doesNotMatch(workflow, /GITHUB_SHA/)
  assert.match(workflow, /expected_revision:/)
  assert.match(workflow, /EXPECTED_REVISION:/)
  assert.match(
    workflow,
    /\$revision == "" or \.revision == \(\$revision\[0:12\]\)/
  )
})

test("Given final provider acceptance When the production runbook is inspected Then Stripe and recovery proof are executable", () => {
  const production = readFileSync(
    "docs/operations/production-runbook.md",
    "utf8"
  )
  const incident = readFileSync("docs/operations/incident-response.md", "utf8")

  assert.match(production, /live product and all three active Price IDs/i)
  assert.match(production, /prepaid annual Price is\s+GBP 699\.90/i)
  assert.match(production, /payment-method-update flow/i)
  assert.match(production, /exit review/i)
  assert.match(production, /signed webhook delivery/i)
  assert.match(production, /stripe_webhook_events/)
  assert.match(production, /entitlement/i)
  assert.match(incident, /two consecutive scheduled Production smoke runs/i)
  assert.doesNotMatch(incident, /error rate remains normal/i)
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
    .map((entry) => `${entry.name}=${serializeEnvValue(testValue(entry))}`)

  values.push(`TWILIO_AUTH_TOKEN=${serializeEnvValue("test-auth-token")}`)
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

function validVapidEnvironment() {
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
