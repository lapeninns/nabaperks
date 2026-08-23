import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, watch } from "node:fs"
import { once } from "node:events"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const ACCOUNTING = fileURLToPath(
  new URL("../support/task15-bootstrap-accounting.mjs", import.meta.url)
)

function fixture(source) {
  return [process.execPath, "--input-type=module", "--eval", source]
}

function runAccounted(pattern, command, options = {}) {
  return spawnSync(
    process.execPath,
    [ACCOUNTING, "--started-pattern", pattern, "--", ...command],
    { encoding: "utf8", ...options }
  )
}

function report(result) {
  assert.equal(result.stderr, "")
  return JSON.parse(result.stdout)
}

async function waitFor(path) {
  if (existsSync(path)) return
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      watcher.close()
      reject(new Error(`Timed out waiting for ${path}`))
    }, 2_000)
    const watcher = watch(join(path, ".."), () => {
      if (!existsSync(path)) return
      clearTimeout(timer)
      watcher.close()
      resolve()
    })
  })
}

async function waitForExit(pid) {
  const deadline = Date.now() + 500
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if (error?.code === "ESRCH") return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.fail(`Process ${pid} did not exit within 500ms`)
}

test("Given a command reaches a scanner and reports nonzero totals When accounting observes its nonzero exit Then it remains executed", () => {
  const command = fixture(
    'console.log("TASK15_SCANNER_STARTED"); console.log("TASK15_TOTAL tests=3 passed=2 failed=1"); process.exit(1)'
  )
  const result = runAccounted("TASK15_SCANNER_STARTED", command)
  const accounting = report(result)

  assert.equal(result.status, 1)
  assert.deepEqual(accounting.command, command)
  assert.equal(accounting.exitCode, 1)
  assert.equal(accounting.execution, "executed")
  assert.equal(accounting.executionCount, 1)
  assert.equal(accounting.result, "failed")
  assert.equal(accounting.diagnostic, "COMMAND_STARTED")
  assert.ok(accounting.output.stdoutBytes > 0)
  assert.equal(accounting.output.stderrBytes, 0)
})

test("Given a browser command exits zero without Playwright totals When accounting requires browser proof Then it fails closed", async () => {
  const { accountExecution } = await import(ACCOUNTING)
  const accounting = await accountExecution(
    fixture('console.log("Running 3 tests using 1 worker")'),
    /Running \d+ tests using \d+ worker/,
    { requirePlaywrightTotals: true }
  )

  assert.equal(accounting.exitCode, 0)
  assert.equal(accounting.executionCount, 1)
  assert.equal(accounting.result, "failed")
  assert.equal(accounting.diagnostic, "PLAYWRIGHT_TOTALS_NOT_CONFIRMED")
  assert.deepEqual(accounting.browserTotals, {
    tests: 3,
    passed: 0,
    failed: 0,
    skipped: 0,
  })
})

test("Given a command prints the suite-start marker twice When accounting observes it Then it rejects repeated execution", () => {
  const command = fixture(
    'console.log("TASK15_SCANNER_STARTED"); console.log("TASK15_SCANNER_STARTED")'
  )
  const result = runAccounted("TASK15_SCANNER_STARTED", command)
  const accounting = report(result)

  assert.equal(result.status, 1)
  assert.equal(accounting.executionCount, 2)
  assert.equal(accounting.result, "failed")
  assert.equal(accounting.diagnostic, "COMMAND_EXECUTION_COUNT_MISMATCH")
})

test("Given bootstrap fails before a scanner starts When accounting observes its nonzero exit Then it reports pre-suite failure", () => {
  const result = runAccounted(
    "TASK15_SCANNER_STARTED",
    fixture('console.error("COREPACK_SIGNATURE_UNAVAILABLE"); process.exit(1)')
  )
  const accounting = report(result)

  assert.equal(result.status, 1)
  assert.equal(accounting.execution, "pre-suite-bootstrap-failure")
  assert.equal(accounting.executionCount, 0)
  assert.equal(accounting.diagnostic, "COMMAND_START_NOT_CONFIRMED")
})

test("Given the package manager is unavailable on an isolated PATH When accounting invokes it Then it fails closed with a stable diagnostic", () => {
  const result = runAccounted("TASK15_SCANNER_STARTED", ["pnpm", "lint"], {
    env: { PATH: "/task15-empty-path" },
  })
  const accounting = report(result)

  assert.equal(result.status, 1)
  assert.equal(accounting.executionCount, 0)
  assert.equal(accounting.diagnostic, "PACKAGE_MANAGER_UNAVAILABLE")
})

test("Given malformed accounting arguments When the CLI starts Then it rejects before invoking a command", () => {
  const result = spawnSync(
    process.execPath,
    [ACCOUNTING, "--started-pattern"],
    {
      encoding: "utf8",
    }
  )

  assert.equal(result.status, 64)
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /"error":"INVALID_ARGUMENTS"/)
})

test("Given an invoked command exceeds its bounded accounting window When the CLI waits Then it fails closed as a timeout", () => {
  const result = spawnSync(
    process.execPath,
    [
      ACCOUNTING,
      "--timeout-ms",
      "25",
      "--started-pattern",
      "TASK15_SCANNER_STARTED",
      "--",
      ...fixture(
        'console.log("TASK15_SCANNER_STARTED"); setInterval(() => {}, 1_000)'
      ),
    ],
    { encoding: "utf8" }
  )

  assert.equal(result.status, 1)
  assert.equal(report(result).diagnostic, "BOOTSTRAP_ACCOUNTING_TIMEOUT")
})

test("Given a timed out command starts an owned descendant When accounting stops it Then the descendant is gone", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "nabaperks-task15-bootstrap-red-")
  )
  const childPidPath = join(fixtureRoot, "child.pid")
  const source = [
    'import { spawn } from "node:child_process";',
    `const child = spawn(process.execPath, ["--eval", ${JSON.stringify(
      `require("node:fs").writeFileSync(${JSON.stringify(childPidPath)}, String(process.pid)); process.stdout.write("ready"); setInterval(() => {}, 1_000)`
    )}], { stdio: ["ignore", "pipe", "ignore"] });`,
    'await new Promise((resolve, reject) => { child.stdout.once("data", resolve); child.once("error", reject); });',
    "child.unref();",
    "child.stdout.unref();",
    'console.log("TASK15_SCANNER_STARTED");',
    "setInterval(() => {}, 1_000);",
  ].join(" ")

  try {
    const result = spawnSync(
      process.execPath,
      [
        ACCOUNTING,
        "--timeout-ms",
        "500",
        "--started-pattern",
        "TASK15_SCANNER_STARTED",
        "--",
        ...fixture(source),
      ],
      { encoding: "utf8", timeout: 5_000 }
    )

    assert.equal(result.status, 1)
    assert.equal(report(result).diagnostic, "BOOTSTRAP_ACCOUNTING_TIMEOUT")
    assert.equal(existsSync(childPidPath), true)
    const childPid = Number(readFileSync(childPidPath, "utf8"))
    assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" })
  } finally {
    if (existsSync(childPidPath)) {
      const childPid = Number(readFileSync(childPidPath, "utf8"))
      try {
        process.kill(childPid, "SIGKILL")
      } catch (error) {
        if (error?.code !== "ESRCH") throw error
      }
    }
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test("Given accounting receives cancellation after an owned descendant starts When it exits Then the descendant is gone", async () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "nabaperks-task15-bootstrap-cancel-")
  )
  const childPidPath = join(fixtureRoot, "child.pid")
  const source = [
    'import { spawn } from "node:child_process";',
    `const child = spawn(process.execPath, ["--eval", ${JSON.stringify(
      `require("node:fs").writeFileSync(${JSON.stringify(childPidPath)}, String(process.pid)); setInterval(() => {}, 1_000)`
    )}], { stdio: "ignore" });`,
    "child.unref();",
    'console.log("TASK15_SCANNER_STARTED");',
    "setInterval(() => {}, 1_000);",
  ].join(" ")
  const accounting = spawn(
    process.execPath,
    [
      ACCOUNTING,
      "--timeout-ms",
      "5000",
      "--started-pattern",
      "TASK15_SCANNER_STARTED",
      "--",
      ...fixture(source),
    ],
    { stdio: "ignore" }
  )

  try {
    await waitFor(childPidPath)
    process.kill(accounting.pid, "SIGTERM")
    const [exitCode] = await once(accounting, "close")
    assert.notEqual(exitCode, 0)
    const childPid = Number(readFileSync(childPidPath, "utf8"))
    await waitForExit(childPid)
  } finally {
    if (existsSync(childPidPath)) {
      const childPid = Number(readFileSync(childPidPath, "utf8"))
      try {
        process.kill(childPid, "SIGKILL")
      } catch (error) {
        if (error?.code !== "ESRCH") throw error
      }
    }
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})
