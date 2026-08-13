import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { tmpdir } from "node:os"

const ROOT = process.cwd()
const SCRIPT = join(ROOT, "scripts/check-bundle-size.mjs")
const BUDGET = join(ROOT, "config/bundle-budget.json")

function withBundleFixture(manifestSource, callback) {
  const fixture = mkdtempSync(join(tmpdir(), "nabaperks-bundle-size-"))
  try {
    mkdirSync(join(fixture, ".next/server/app"), { recursive: true })
    mkdirSync(join(fixture, ".next/static/chunks"), { recursive: true })
    mkdirSync(join(fixture, "config"), { recursive: true })
    cpSync(SCRIPT, join(fixture, "check-bundle-size.mjs"))
    cpSync(BUDGET, join(fixture, "config/bundle-budget.json"))
    writeFileSync(join(fixture, ".next/build-manifest.json"), "{}")
    if (manifestSource) {
      writeFileSync(
        join(fixture, ".next/server/app/page_client-reference-manifest.js"),
        manifestSource
      )
      writeFileSync(
        join(fixture, ".next/static/chunks/page.js"),
        "valid route fixture\n"
      )
    }
    return callback(fixture)
  } finally {
    if (existsSync(fixture)) rmSync(fixture, { recursive: true, force: true })
  }
}

function runBundleCheck(fixture) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd: fixture,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { exitCode: 0, stdout, stderr: "" }
  } catch (error) {
    assert.equal(typeof error, "object")
    assert.notEqual(error, null)
    const result = error
    return {
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }
}

test("Given a valid non-empty manifest, bundle check preserves route accounting", () => {
  const manifest =
    '"entryJSFiles":{"app/page":["/_next/static/chunks/page.js"]}'
  withBundleFixture(manifest, (fixture) => {
    const result = runBundleCheck(fixture)

    assert.equal(result.exitCode, 0)
    assert.equal(
      result.stdout,
      "Bundle budget passed: root first-load JS 0 bytes, 1 app entries checked.\n"
    )
    assert.equal(result.stderr, "")
  })
})

test("Given an empty manifest, bundle check rejects zero parsed application routes", () => {
  withBundleFixture("", (fixture) => {
    const result = runBundleCheck(fixture)

    assert.notEqual(result.exitCode, 0)
    assert.equal(
      result.stderr,
      "Bundle check found no application route entries to evaluate.\n"
    )
  })
})

test("Given malformed manifest input When the bundle check runs Then it fails instead of reporting a budget pass", () => {
  withBundleFixture('"entryJSFiles":{', (fixture) => {
    const result = runBundleCheck(fixture)

    assert.notEqual(result.exitCode, 0)
    assert.equal(result.stdout, "")
  })
})

test("Given a route chunk over the configured limit When the bundle check runs Then it fails with the over-budget path", () => {
  const manifest =
    '"entryJSFiles":{"app/page":["/_next/static/chunks/page.js"]}'
  withBundleFixture(manifest, (fixture) => {
    const budget = JSON.parse(readFileSync(BUDGET, "utf8"))
    writeFileSync(
      join(fixture, ".next/static/chunks/oversized.js"),
      "x".repeat(budget.maxSingleChunkBytes + 1)
    )

    const result = runBundleCheck(fixture)

    assert.notEqual(result.exitCode, 0)
    assert.match(result.stderr, /oversized\.js is \d+ bytes, budget is \d+\./)
  })
})
