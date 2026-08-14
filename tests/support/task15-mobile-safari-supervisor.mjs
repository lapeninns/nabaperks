#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  rmdirSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const TEMP_PREFIX = "task15-mobile-safari-supervisor-"
const requestedRoot = process.env.TASK15_MOBILE_SUPERVISOR_ROOT
const fixtureMode = process.env.TASK15_MOBILE_SUPERVISOR_FIXTURE

if (process.argv.length !== 2) fail("INVALID_ARGUMENTS")
if (fixtureMode !== undefined && fixtureMode !== "hung-descendant")
  fail("INVALID_FIXTURE")

let supervisorRoot
if (requestedRoot === undefined) {
  supervisorRoot = mkdtempSync(join(tmpdir(), TEMP_PREFIX))
} else {
  supervisorRoot = resolve(requestedRoot)
  if (
    dirname(supervisorRoot) !== resolve(tmpdir()) ||
    !/^task15-mobile-safari-supervisor-\d+$/.test(basename(supervisorRoot)) ||
    existsSync(supervisorRoot)
  ) {
    fail("INVALID_CLEANUP_ROOT")
  }
  mkdirSync(supervisorRoot, { mode: 0o700 })
}

const namespace = `task15-mobile-safari-${process.pid}`
const testResults = join(PROJECT_ROOT, "test-results")
const ownedPaths = [
  join(PROJECT_ROOT, ".next-e2e"),
  join(PROJECT_ROOT, "playwright-report"),
  join(testResults, namespace),
  join(testResults, `${namespace}-sentinel.txt`),
  supervisorRoot,
]
const testResultsExisted = existsSync(testResults)

for (const path of [
  join(PROJECT_ROOT, ".env.local"),
  ...ownedPaths.slice(0, 4),
]) {
  if (existsSync(path)) {
    rmSync(supervisorRoot, { recursive: true })
    fail("PREEXISTING_OWNED_PATH")
  }
}

const child = spawn(
  process.execPath,
  fixtureMode === "hung-descendant"
    ? [
        "--eval",
        'const { spawn } = require("node:child_process"); process.on("SIGTERM", () => {}); const child = spawn(process.execPath, ["--eval", "process.on(\\"SIGTERM\\", () => {}); setInterval(() => {}, 1000)"], { stdio: "ignore" }); child.unref(); console.log("HUNG_DESCENDANT_READY"); setInterval(() => {}, 1000)',
      ]
    : ["--test", "tests/unit/task15-mobile-safari-bootstrap.test.mjs"],
  {
    cwd: PROJECT_ROOT,
    detached: true,
    env: {
      ...process.env,
      TASK15_MOBILE_OUTPUT_NAMESPACE: namespace,
    },
    stdio: "inherit",
  }
)
const closed = new Promise((resolveClose) => {
  child.once("error", (error) => resolveClose({ code: 1, error, signal: null }))
  child.once("close", (code, signal) =>
    resolveClose({ code: code ?? 1, error: null, signal })
  )
})

let cancellation
const cancel = () => {
  if (cancellation !== undefined) return
  cancellation = cancelAndClean()
}
process.on("SIGINT", cancel)
process.on("SIGTERM", cancel)

const result = await closed
if (cancellation !== undefined) {
  await cancellation
  process.exitCode = 130
} else {
  cleanup()
  verifyCleanup()
  if (result.error !== null) console.error(result.error.message)
  process.exitCode = result.code
}

async function cancelAndClean() {
  const tree = processTree(child.pid)
  signalTree(tree, "SIGKILL")
  await closed
  if (!(await waitForExit(tree.ownedPids, 2_500))) {
    cleanup()
    fail("OWNED_PROCESS_DID_NOT_EXIT")
  }
  cleanup()
  verifyCleanup()
}

function cleanup() {
  for (const path of ownedPaths) rmSync(path, { recursive: true, force: true })
  if (!testResultsExisted && existsSync(testResults)) {
    if (readdirSync(testResults).length === 0) rmdirSync(testResults)
  }
}

function verifyCleanup() {
  const residue = ownedPaths.filter(existsSync)
  if (!testResultsExisted && existsSync(testResults)) residue.push(testResults)
  if (residue.length > 0) fail("OWNED_PATH_CLEANUP_FAILED")
}

function processTree(rootPid) {
  const rows = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,pgid="], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((row) => row.trim().split(/\s+/).map(Number))
  const ownedPids = [rootPid]
  for (let index = 0; index < ownedPids.length; index += 1) {
    for (const [pid, parentPid] of rows) {
      if (parentPid === ownedPids[index] && !ownedPids.includes(pid))
        ownedPids.push(pid)
    }
  }
  const ownedGroups = [
    ...new Set(
      rows.filter(([pid]) => ownedPids.includes(pid)).map((row) => row[2])
    ),
  ]
  return { ownedGroups, ownedPids }
}

function signalTree(tree, signal) {
  for (const group of tree.ownedGroups) signalProcess(-group, signal)
}

function signalProcess(pid, signal) {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (error?.code !== "ESRCH") throw error
  }
}

async function waitForExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pids.every((pid) => !processExists(pid))) return true
    await new Promise((resolveWait) => setTimeout(resolveWait, 20))
  }
  return pids.every((pid) => !processExists(pid))
}

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error?.code === "ESRCH") return false
    throw error
  }
}

function fail(code) {
  console.error(code)
  process.exit(64)
}
