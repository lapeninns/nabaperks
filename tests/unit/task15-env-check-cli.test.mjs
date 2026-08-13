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
const validVapidValues = createValidVapidValues()

test("Given a deterministic complete fixture When the environment CLI runs Then it exits successfully within the bound", () => {
  const result = runEnvCheck({ profile: "production" })

  assert.equal(result.error, undefined)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /production environment configuration is valid/)
  assert.ok(result.durationMs < 15_000)
})

test("Given a missing required key When the environment CLI runs Then it fails promptly without echoing values", () => {
  const fixtureSecret = "prompt-like-secret-do-not-echo-123456789"
  const result = runEnvCheck({
    profile: "production",
    environment: { CRON_SECRET: "", CUSTOMER_SESSION_SECRET: fixtureSecret },
  })

  assert.equal(result.error, undefined)
  assert.equal(result.signal, null)
  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /^Nabaperks environment configuration is incomplete\.$/m
  )
  assert.match(result.stderr, /^Missing: .*CRON_SECRET/m)
  assert.doesNotMatch(result.stderr, new RegExp(fixtureSecret))
  assert.ok(result.durationMs < 15_000)
})

test("Given missing extra or malformed arguments When the environment CLI runs Then it rejects each boundary", () => {
  for (const args of [["--profile"], ["--unexpected"], ["--profile=unknown"]]) {
    const result = runEnvCheck({ args })

    assert.equal(result.error, undefined)
    assert.equal(result.signal, null)
    assert.equal(result.status, 1, result.stderr)
    assert.match(
      result.stderr,
      /Unknown env check argument|Unknown env check profile/
    )
    assert.ok(result.durationMs < 15_000)
  }
})

test("Given a FIFO environment file When the environment CLI runs Then it rejects the unsafe input instead of timing out", () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "nabaperks-task15-env-fifo-"))

  try {
    cpSync(join(projectDir, "config"), join(fixtureDir, "config"), {
      recursive: true,
    })
    const fifoPath = join(fixtureDir, ".env")
    const created = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" })
    assert.equal(created.status, 0, created.stderr)

    const result = runCommand({
      cwd: fixtureDir,
      args: ["--profile=production"],
    })

    assert.equal(result.error, undefined)
    assert.equal(result.signal, null, "CLI timed out while reading a FIFO")
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /\.env must be a regular file/)
    assert.ok(result.durationMs < 15_000)
  } finally {
    rmSync(fixtureDir, { force: true, recursive: true })
  }
})

function runEnvCheck({ args = [], environment = {}, profile }) {
  const fixtureDir = mkdtempSync(join(tmpdir(), "nabaperks-task15-env-cli-"))

  try {
    cpSync(join(projectDir, "config"), join(fixtureDir, "config"), {
      recursive: true,
    })
    writeFileSync(
      join(fixtureDir, ".env"),
      `${Object.entries({ ...validEnvironment(), ...environment })
        .map(([name, value]) => `${name}=${serializeEnvValue(value)}`)
        .join("\n")}\n`
    )

    return runCommand({
      cwd: fixtureDir,
      args: [...args, ...(profile ? [`--profile=${profile}`] : [])],
    })
  } finally {
    rmSync(fixtureDir, { force: true, recursive: true })
  }
}

function runCommand({ cwd, args }) {
  const startedAt = performance.now()
  const result = spawnSync(process.execPath, [checkEnvScript, ...args], {
    cwd,
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "" },
    timeout: 2_000,
  })

  return { ...result, durationMs: performance.now() - startedAt }
}

function validEnvironment() {
  return Object.fromEntries(
    envContract.map((entry) => [entry.name, validEnvironmentValue(entry)])
  )
}

function validEnvironmentValue(entry) {
  if (entry.name in validVapidValues) return validVapidValues[entry.name]
  if (entry.name === "NEXT_PUBLIC_SUPABASE_URL") {
    return "https://fixture.supabase.co"
  }
  if (entry.kind === "url") return "https://fixture.example.test"
  if (entry.kind === "postgres-url") {
    return "postgres://fixture:fixture@fixture.example.test/fixture"
  }
  if (entry.name === "SUPABASE_SEND_EMAIL_HOOK_SECRET") {
    return "v1,whsec_SDkhbVEyQHZSNyNjVDQkeUs4XnBEMyZ6RjYqd041P3g="
  }
  if (entry.name === "SUPABASE_SEND_SMS_HOOK_SECRET") {
    return "v1,whsec_R0FiY0RlRjAxMjM0NTY3ODktQUJDREVGR0hJSktMTU4="
  }
  if (entry.name === "ANALYTICS_EXTERNAL_PROCESSING_MODE") {
    return "disabled"
  }
  if (entry.name === "CUSTOMER_OTP_BYPASS_MODE") return ""
  if (entry.name === "CUSTOMER_DEV_OTP_CODE") return ""
  return `H9!mD4@qL7#vR2$tK8^xC5&pN3*zW6?${entry.name.length}`
}

function createValidVapidValues() {
  const curve = createECDH("prime256v1")
  curve.generateKeys()
  const privateKey = curve.getPrivateKey()
  const paddedPrivateKey =
    privateKey.length >= 32
      ? privateKey
      : Buffer.concat([Buffer.alloc(32 - privateKey.length), privateKey])

  return {
    WEB_PUSH_VAPID_PRIVATE_KEY: paddedPrivateKey.toString("base64url"),
    WEB_PUSH_VAPID_PUBLIC_KEY: curve.getPublicKey().toString("base64url"),
    WEB_PUSH_VAPID_SUBJECT: "mailto:fixture@example.test",
  }
}
