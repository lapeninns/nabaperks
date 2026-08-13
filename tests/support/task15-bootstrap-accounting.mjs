#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const SCHEMA = "nabaperks.task15.bootstrap-accounting.v1"
const USAGE =
  "usage: node tests/support/task15-bootstrap-accounting.mjs [--timeout-ms <1-180000>] --started-pattern <regex> -- <command> [args...]"

function installPlaywrightOutputCleanup() {
  const isPlaywrightCli =
    process.env.TASK15_LITERAL_PLAYWRIGHT_CLEANUP === "1" &&
    process.argv[2] === "test" &&
    /(?:^|[/\\])@?playwright(?:[/\\]test)?[/\\]cli\.js$/.test(
      process.argv[1] ?? ""
    )
  if (!isPlaywrightCli) return

  const output = join(process.cwd(), "test-results")
  const lastRunRoot = join(process.cwd(), ".next-e2e")
  const lastRunFile = join(lastRunRoot, ".last-run.json")
  const lastRunRootExisted = existsSync(lastRunRoot)
  const previousLastRun = existsSync(lastRunFile)
    ? readFileSync(lastRunFile)
    : null
  const backupRoot = existsSync(output)
    ? mkdtempSync(join(tmpdir(), "task15-playwright-output-"))
    : null
  const backup = backupRoot === null ? null : join(backupRoot, "test-results")
  if (backup !== null) renameSync(output, backup)
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    rmSync(output, { recursive: true, force: true })
    if (backup !== null) renameSync(backup, output)
    if (backupRoot !== null) rmSync(backupRoot, { recursive: true })
    rmSync(lastRunFile, { force: true })
    if (previousLastRun !== null) {
      mkdirSync(lastRunRoot, { recursive: true })
      writeFileSync(lastRunFile, previousLastRun)
    } else if (!lastRunRootExisted) {
      rmSync(lastRunRoot, { recursive: true, force: true })
    }
  }
  process.once("exit", cleanup)
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      cleanup()
      process.kill(process.pid, signal)
    })
  }
}

installPlaywrightOutputCleanup()

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function parse(argv) {
  const timeout = argv[0] === "--timeout-ms" ? Number(argv[1]) : 30_000
  const offset = argv[0] === "--timeout-ms" ? 2 : 0
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 180_000) {
    return { error: "INVALID_TIMEOUT" }
  }
  if (
    argv[offset] !== "--started-pattern" ||
    argv.length < offset + 4 ||
    argv[offset + 2] !== "--"
  ) {
    return { error: "INVALID_ARGUMENTS" }
  }
  const pattern = argv[offset + 1]
  if (pattern.length === 0 || pattern.length > 160 || /[\r\n]/.test(pattern)) {
    return { error: "INVALID_STARTED_PATTERN" }
  }
  try {
    return {
      command: argv.slice(offset + 3),
      started: new RegExp(pattern, "m"),
      timeout,
    }
  } catch {
    return { error: "INVALID_STARTED_PATTERN" }
  }
}

function stopProcessGroup(pid) {
  if (typeof pid !== "number") return
  try {
    process.kill(-pid, "SIGKILL")
  } catch (error) {
    if (error?.code !== "ESRCH") throw error
  }
}

function playwrightTotals(output) {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "")
  const planned = plain.match(/Running (\d+) tests? using \d+ workers?/)
  const count = (label) => {
    const match = plain.match(
      new RegExp(`(?:^|\\n)\\s*(\\d+) ${label}(?:\\s|$)`)
    )
    return match === null ? 0 : Number(match[1])
  }
  return {
    tests: planned === null ? 0 : Number(planned[1]),
    passed: count("passed"),
    failed: count("failed"),
    skipped: count("skipped"),
  }
}

function executionCount(output, pattern) {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`
  return [...output.matchAll(new RegExp(pattern.source, flags))].length
}

export async function accountExecution(command, started, options = {}) {
  const child = spawn(command[0], command.slice(1), {
    cwd: options.cwd,
    detached: true,
    encoding: "utf8",
    env: options.env,
  })
  options.onStarted?.(child.pid)
  const stdoutParts = []
  const stderrParts = []
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (part) => stdoutParts.push(part))
  child.stderr?.on("data", (part) => stderrParts.push(part))
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    stopProcessGroup(child.pid)
  }, options.timeoutMs ?? 30_000)
  const result = await new Promise((resolve) => {
    child.once("error", (error) =>
      resolve({ error, signal: null, status: null })
    )
    child.once("close", (status, signal) =>
      resolve({ error: null, signal, status })
    )
  })
  clearTimeout(timeout)
  stopProcessGroup(child.pid)
  const stdout = stdoutParts.join("")
  const stderr = stderrParts.join("")
  const output = `${stdout}${stderr}`
  const observedExecutionCount = executionCount(output, started)
  const executed = observedExecutionCount > 0
  const launchError = result.error?.code ?? null
  const browserTotals = options.requirePlaywrightTotals
    ? playwrightTotals(output)
    : null
  const browserProofConfirmed =
    browserTotals === null ||
    (browserTotals.tests > 0 &&
      browserTotals.passed === browserTotals.tests &&
      browserTotals.failed === 0 &&
      browserTotals.skipped === 0)
  return {
    schema: SCHEMA,
    command,
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    execution: executed ? "executed" : "pre-suite-bootstrap-failure",
    executionCount: observedExecutionCount,
    result:
      result.status === 0 &&
      observedExecutionCount === 1 &&
      browserProofConfirmed
        ? "passed"
        : "failed",
    diagnostic: timedOut
      ? "BOOTSTRAP_ACCOUNTING_TIMEOUT"
      : launchError === "ENOENT"
        ? "PACKAGE_MANAGER_UNAVAILABLE"
        : observedExecutionCount > 1
          ? "COMMAND_EXECUTION_COUNT_MISMATCH"
          : executed
            ? browserProofConfirmed
              ? "COMMAND_STARTED"
              : "PLAYWRIGHT_TOTALS_NOT_CONFIRMED"
            : "COMMAND_START_NOT_CONFIRMED",
    ...(browserTotals === null ? {} : { browserTotals }),
    output: {
      sha256: digest(output),
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: Buffer.byteLength(stderr),
    },
  }
}

async function main() {
  const parsed = parse(process.argv.slice(2))
  if ("error" in parsed) {
    console.error(
      JSON.stringify({ schema: SCHEMA, error: parsed.error, usage: USAGE })
    )
    process.exitCode = 64
    return
  }
  let processGroup
  const cancel = () => stopProcessGroup(processGroup)
  process.once("SIGINT", cancel)
  process.once("SIGTERM", cancel)
  const accounting = await accountExecution(parsed.command, parsed.started, {
    onStarted: (pid) => {
      processGroup = pid
    },
    timeoutMs: parsed.timeout,
  })
  process.off("SIGINT", cancel)
  process.off("SIGTERM", cancel)
  console.log(JSON.stringify(accounting))
  process.exitCode =
    accounting.exitCode === 0 && accounting.executionCount === 1 ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
