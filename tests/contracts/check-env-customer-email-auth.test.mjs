import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"

/**
 * The deploy gate (`pnpm env:check`, the Vercel buildCommand) for customer
 * email sign-in, run as the real script with a synthetic environment.
 *
 * - QA BUG-015: an unrecognised CUSTOMER_EMAIL_AUTH_MODE is only safe at
 *   runtime because the parser treats it as `off`; the gate must still refuse
 *   it so the typo is caught before release.
 * - QA BUG-016: `existing` and `full` hash every address with
 *   CUSTOMER_EMAIL_HMAC_SECRET. Without it the email step cannot work, so the
 *   gate must refuse the mode instead of letting guests reach a broken step.
 */

const projectDir = resolve(import.meta.dirname, "../..")
const checkEnvScript = join(projectDir, "scripts/check-env.mjs")
const envContract = JSON.parse(
  readFileSync(join(projectDir, "config/env-contract.json"), "utf8")
)
const HMAC_REQUIRED =
  /CUSTOMER_EMAIL_HMAC_SECRET \(required when customer email sign-in is on\)/
const MODE_INVALID = /CUSTOMER_EMAIL_AUTH_MODE must be off, existing or full/

const STRONG_SECRET_NAMES = new Set([
  "CRON_SECRET",
  "PRODUCTION_MONITOR_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "CUSTOMER_PHONE_HMAC_SECRET",
  "CUSTOMER_PHONE_ENCRYPTION_KEY",
  "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY",
])

function strongSecret(name) {
  return `N7!qL2@vR9#cT4$yH6^mK8&pD3*zF5?${name.length}`
}

function baseEnvironment() {
  const values = {}
  for (const entry of envContract) {
    if (entry.optional) continue
    if (entry.name === "NEXT_PUBLIC_SUPABASE_URL") {
      values[entry.name] = "https://ci.supabase.co"
    } else if (entry.kind === "url") {
      values[entry.name] = "https://example.test"
    } else if (STRONG_SECRET_NAMES.has(entry.name)) {
      values[entry.name] = strongSecret(entry.name)
    } else {
      values[entry.name] =
        `fixture-${entry.name.toLowerCase()}-0123456789abcdef`
    }
  }
  values.TWILIO_AUTH_TOKEN = "test-auth-token"
  return values
}

function runEnvCheck(overrides, args = []) {
  const fixtureDir = mkdtempSync(join(tmpdir(), "nabaperks-email-auth-env-"))
  try {
    cpSync(join(projectDir, "config"), join(fixtureDir, "config"), {
      recursive: true,
    })
    const environment = { ...baseEnvironment(), ...overrides }
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined) delete environment[name]
    }
    return spawnSync(process.execPath, [checkEnvScript, ...args], {
      cwd: fixtureDir,
      encoding: "utf8",
      env: {
        HOME: process.env.HOME ?? "",
        NODE_ENV: "test",
        PATH: process.env.PATH ?? "",
        ...environment,
      },
    })
  } finally {
    rmSync(fixtureDir, { force: true, recursive: true })
  }
}

test("Given an unrecognised email sign-in mode When the deploy gate runs Then it fails naming the setting", () => {
  for (const mode of ["FULL", "on", "full,existing"]) {
    const result = runEnvCheck({
      CUSTOMER_EMAIL_AUTH_MODE: mode,
      CUSTOMER_EMAIL_HMAC_SECRET: strongSecret("CUSTOMER_EMAIL_HMAC_SECRET"),
    })
    assert.equal(result.status, 1, mode)
    assert.match(result.stderr, MODE_INVALID, mode)
  }
})

test("Given email sign-in on without the email HMAC secret When the deploy gate runs Then it fails naming the secret", () => {
  for (const mode of ["existing", "full", "  full  "]) {
    for (const secret of [undefined, "", "   "]) {
      const result = runEnvCheck({
        CUSTOMER_EMAIL_AUTH_MODE: mode,
        CUSTOMER_EMAIL_HMAC_SECRET: secret,
      })
      assert.equal(result.status, 1, `${mode} / ${JSON.stringify(secret)}`)
      assert.match(result.stderr, HMAC_REQUIRED, mode)
    }
  }
})

test("Given the production profile with email sign-in on and no HMAC secret When the gate runs Then the secret is reported", () => {
  const result = runEnvCheck(
    { CUSTOMER_EMAIL_AUTH_MODE: "full", CUSTOMER_EMAIL_HMAC_SECRET: undefined },
    ["--profile=production"]
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, HMAC_REQUIRED)
})

test("Given email sign-in off or configured with its secret When the deploy gate runs Then it passes", () => {
  for (const overrides of [
    {
      CUSTOMER_EMAIL_AUTH_MODE: undefined,
      CUSTOMER_EMAIL_HMAC_SECRET: undefined,
    },
    { CUSTOMER_EMAIL_AUTH_MODE: "off", CUSTOMER_EMAIL_HMAC_SECRET: undefined },
    {
      CUSTOMER_EMAIL_AUTH_MODE: "existing",
      CUSTOMER_EMAIL_HMAC_SECRET: strongSecret("CUSTOMER_EMAIL_HMAC_SECRET"),
    },
    {
      CUSTOMER_EMAIL_AUTH_MODE: "full",
      CUSTOMER_EMAIL_HMAC_SECRET: strongSecret("CUSTOMER_EMAIL_HMAC_SECRET"),
    },
  ]) {
    const result = runEnvCheck(overrides)
    assert.equal(
      result.status,
      0,
      `${JSON.stringify(overrides)}: ${result.stderr}`
    )
  }
})
