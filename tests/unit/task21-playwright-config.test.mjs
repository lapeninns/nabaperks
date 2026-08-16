import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const PROJECT_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

test("Given Task21 matrix mode When Playwright loads config Then exact-SHA supervisor readiness and zero retries are active", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "--list",
      "--reporter=json",
      "--project=chromium",
      "tests/e2e/architecture-harness-gate.desktop.spec.ts",
    ],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "1",
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:31721",
        TASK21_PLAYWRIGHT_MATRIX: "1",
      },
    }
  )

  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.config.projects[1].retries, 0)
  assert.deepEqual(report.config.webServer?.gracefulShutdown, {
    signal: "SIGTERM",
    timeout: 5_000,
  })
  assert.match(
    report.config.webServer.command,
    /task21-playwright-server-supervisor\.mjs/
  )
  assert.equal(
    report.config.webServer.url,
    "http://127.0.0.1:41721/task21-ready"
  )
})

test("Given an unsafe Task21 app port When Playwright loads config Then it fails closed", () => {
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--list", "--project=chromium"],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:60000",
        TASK21_PLAYWRIGHT_MATRIX: "1",
      },
    }
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Invalid Task21 Playwright base port/)
})
