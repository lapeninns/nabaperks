import assert from "node:assert/strict"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:net"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { accountExecution } from "../support/task15-bootstrap-accounting.mjs"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const ENV_LOCAL = fileURLToPath(new URL("../../.env.local", import.meta.url))
const PLAYWRIGHT_SCRATCH = [".next-e2e", "playwright-report"].map((path) =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url))
)
const TEST_RESULTS = fileURLToPath(
  new URL("../../test-results", import.meta.url)
)
const PUBLIC_FIXTURE = {
  NODE_OPTIONS: "--import=./tests/support/task15-bootstrap-accounting.mjs",
  TASK15_LITERAL_PLAYWRIGHT_CLEANUP: "1",
  PLAYWRIGHT_LAST_RUN_OUTPUT_FILE: ".next-e2e/.last-run.json",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "playwright-public-fixture",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_playwright_fixture",
}

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  assert.notEqual(address, null)
  assert.equal(typeof address, "object")
  const port = address.port
  await new Promise((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error)))
  )
  return port
}

test(
  "Given bounded public fixtures When the exact mobile Safari smoke command runs Then Playwright reports nonzero passing browser totals once",
  { timeout: 180_000 },
  async () => {
    const port = await availablePort()
    const baseUrl = `http://127.0.0.1:${port}`
    const outputNamespace = `task15-mobile-safari-${process.pid}`
    const taskOutput = `${TEST_RESULTS}/${outputNamespace}`
    const sentinel = `${TEST_RESULTS}/${outputNamespace}-sentinel.txt`
    assert.equal(existsSync(ENV_LOCAL), false)
    const testResultsExisted = existsSync(TEST_RESULTS)
    mkdirSync(TEST_RESULTS, { recursive: true })
    writeFileSync(sentinel, "preserve unrelated test output\n", {
      flag: "wx",
      mode: 0o600,
    })
    const scratchExisted = PLAYWRIGHT_SCRATCH.map((path) => existsSync(path))
    const command = [
      "pnpm",
      "test:e2e",
      "--",
      "tests/e2e/harness-smoke.spec.ts",
      "--project=mobile-safari",
      "--reporter=line",
      "--workers=1",
      "--retries=0",
    ]
    const childEnv = { ...process.env }
    childEnv.TASK15_PLAYWRIGHT_OUTPUT_NAMESPACE = outputNamespace
    for (const name of [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_WORKERS",
      "PLAYWRIGHT_RETRIES",
    ]) {
      delete childEnv[name]
    }
    Object.assign(childEnv, PUBLIC_FIXTURE, {
      NEXT_PUBLIC_APP_URL: baseUrl,
      PLAYWRIGHT_BASE_URL: baseUrl,
    })
    let accounting
    try {
      accounting = await accountExecution(
        command,
        /Running \d+ tests? using \d+ workers?/,
        {
          cwd: PROJECT_ROOT,
          env: childEnv,
          requirePlaywrightTotals: true,
          timeoutMs: 175_000,
        }
      )
    } finally {
      for (const [index, path] of PLAYWRIGHT_SCRATCH.entries()) {
        if (!scratchExisted[index])
          rmSync(path, { recursive: true, force: true })
      }
      rmSync(taskOutput, { recursive: true, force: true })
    }

    assert.equal(existsSync(ENV_LOCAL), false)
    assert.equal(existsSync(PLAYWRIGHT_SCRATCH[0]), false)
    assert.equal(
      readFileSync(sentinel, "utf8"),
      "preserve unrelated test output\n"
    )
    rmSync(sentinel, { force: true })
    if (!testResultsExisted && readdirSync(TEST_RESULTS).length === 0)
      rmdirSync(TEST_RESULTS)
    assert.equal(existsSync(taskOutput), false)
    assert.deepEqual(accounting.command, command)
    assert.equal(accounting.exitCode, 0)
    assert.equal(accounting.signal, null)
    assert.equal(accounting.executionCount, 1)
    assert.equal(accounting.result, "passed")
    assert.equal(accounting.diagnostic, "COMMAND_STARTED")
    assert.ok(accounting.browserTotals.tests > 0)
    assert.equal(
      accounting.browserTotals.passed,
      accounting.browserTotals.tests
    )
    assert.equal(accounting.browserTotals.failed, 0)
    assert.equal(accounting.browserTotals.skipped, 0)
  }
)
