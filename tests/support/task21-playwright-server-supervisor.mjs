#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const MAX_OLD_SPACE_MB = 4096

class SupervisorError extends Error {
  constructor(code, exitCode = 64) {
    super(code)
    this.exitCode = exitCode
  }
}

async function run() {
  const appUrl = parseAppUrl(process.env.PLAYWRIGHT_BASE_URL)
  const readyPort = parsePort(
    process.env.TASK21_PLAYWRIGHT_READY_PORT,
    "TASK21_INVALID_READY_PORT"
  )
  if (readyPort === Number(appUrl.port))
    throw new SupervisorError("TASK21_READY_PORT_COLLISION")
  const healthTimeoutMs = parseTimeout(
    process.env.TASK21_SERVER_HEALTH_TIMEOUT_MS
  )
  const fixture = process.env.TASK21_SERVER_FIXTURE
  if (fixture !== undefined && !["healthy", "wrong-sha"].includes(fixture))
    throw new SupervisorError("TASK21_INVALID_SERVER_FIXTURE")
  if (/--max-old-space-size(?:=|\s)/.test(process.env.NODE_OPTIONS ?? ""))
    throw new SupervisorError("TASK21_AMBIGUOUS_HEAP_LIMIT")

  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  }).trim()
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new SupervisorError("TASK21_INVALID_GIT_REVISION")
  if (
    fixture === undefined &&
    execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim()
  ) {
    throw new SupervisorError("TASK21_DIRTY_WORKTREE", 66)
  }

  const child = startChild({ appUrl, fixture, revision })
  const childClosed = new Promise((resolveClose) => {
    child.once("error", (error) => resolveClose({ code: 1, error }))
    child.once("close", (code, signal) =>
      resolveClose({ code: code ?? 1, error: null, signal })
    )
  })
  let gate
  let stopping = false
  let stopRequested
  const requested = new Promise((resolveStop) => {
    stopRequested = resolveStop
  })
  const requestStop = () => {
    if (!stopping) {
      stopping = true
      stopRequested()
    }
  }
  process.once("SIGINT", requestStop)
  process.once("SIGTERM", requestStop)

  try {
    const identity = await waitForExactHealth({
      childClosed,
      deadline: Date.now() + healthTimeoutMs,
      healthUrl: new URL("/api/health", appUrl),
      revision,
    })
    gate = await startGate(readyPort, identity)
    console.log(
      `TASK21_SERVER_READY revision=${revision} heapMb=${MAX_OLD_SPACE_MB} appPid=${child.pid}`
    )
    const outcome = await Promise.race([
      requested.then(() => ({ kind: "signal" })),
      childClosed.then((result) => ({ kind: "child", result })),
    ])
    if (outcome.kind === "child" && !stopping) {
      throw new SupervisorError(
        `TASK21_SERVER_EXIT code=${outcome.result.code} signal=${outcome.result.signal ?? "none"}`,
        70
      )
    }
  } finally {
    if (gate) await closeServer(gate)
    await stopChild(child, childClosed)
    process.removeListener("SIGINT", requestStop)
    process.removeListener("SIGTERM", requestStop)
  }
}

function parseAppUrl(raw) {
  if (!raw || !URL.canParse(raw))
    throw new SupervisorError("TASK21_INVALID_BASE_URL")
  const url = new URL(raw)
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !url.port
  )
    throw new SupervisorError("TASK21_INVALID_BASE_URL")
  parsePort(url.port, "TASK21_INVALID_BASE_URL")
  return url
}

function parsePort(raw, code) {
  if (!raw || !/^\d+$/.test(raw)) throw new SupervisorError(code)
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1024 || port > 65_535)
    throw new SupervisorError(code)
  return port
}

function parseTimeout(raw) {
  if (raw === undefined) return 120_000
  if (!/^\d+$/.test(raw))
    throw new SupervisorError("TASK21_INVALID_HEALTH_TIMEOUT")
  const timeout = Number(raw)
  if (!Number.isInteger(timeout) || timeout < 500 || timeout > 180_000)
    throw new SupervisorError("TASK21_INVALID_HEALTH_TIMEOUT")
  return timeout
}

function startChild({ appUrl, fixture, revision }) {
  const env = {
    ...process.env,
    NODE_OPTIONS:
      `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=${MAX_OLD_SPACE_MB}`.trim(),
    PORT: appUrl.port,
    VERCEL_ENV: "staging",
    VERCEL_GIT_COMMIT_SHA: revision,
    VERCEL_TARGET_ENV: "staging",
  }
  const args = fixture
    ? [
        "--eval",
        fixtureSource(
          fixture === "wrong-sha" ? "0".repeat(40) : revision,
          appUrl.port
        ),
      ]
    : ["node_modules/next/dist/bin/next", "dev", "--webpack"]
  return spawn(process.execPath, args, {
    cwd: PROJECT_ROOT,
    detached: true,
    env,
    stdio: "inherit",
  })
}

function fixtureSource(revision, port) {
  return `const http=require("node:http");const server=http.createServer((request,response)=>{if(request.url!=="/api/health"){response.writeHead(404).end();return}response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({status:"ok",revision:${JSON.stringify(revision)},targetEnvironment:"staging"}))});server.listen(${JSON.stringify(Number(port))},"127.0.0.1");const stop=()=>server.close(()=>process.exit(0));process.on("SIGINT",stop);process.on("SIGTERM",stop);`
}

async function waitForExactHealth({
  childClosed,
  deadline,
  healthUrl,
  revision,
}) {
  while (Date.now() < deadline) {
    const childState = await Promise.race([
      childClosed.then((result) => ({ closed: result })),
      new Promise((resolveWait) => setTimeout(() => resolveWait(null), 20)),
    ])
    if (childState)
      throw new SupervisorError("TASK21_SERVER_EXIT_BEFORE_HEALTH", 70)
    try {
      const response = await fetch(healthUrl, {
        headers: { "x-task21-health-probe": "1" },
        signal: AbortSignal.timeout(1_000),
      })
      if (response.ok) {
        const identity = await response.json()
        if (identity.revision !== revision)
          throw new SupervisorError("TASK21_HEALTH_SHA_MISMATCH", 65)
        if (
          identity.status !== "ok" ||
          identity.targetEnvironment !== "staging"
        )
          throw new SupervisorError("TASK21_HEALTH_IDENTITY_MISMATCH", 65)
        return identity
      }
    } catch (error) {
      if (error instanceof SupervisorError) throw error
      if (!(error instanceof TypeError || error?.name === "TimeoutError"))
        throw error
    }
  }
  throw new SupervisorError("TASK21_HEALTH_TIMEOUT", 65)
}

async function startGate(port, identity) {
  const server = createServer((request, response) => {
    if (request.url !== "/task21-ready") {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { "content-type": "application/json" })
    response.end(
      JSON.stringify({ status: "ready", revision: identity.revision })
    )
  })
  await new Promise((resolveListen, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", resolveListen)
  })
  return server
}

async function closeServer(server) {
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose()))
  )
}

async function stopChild(child, childClosed) {
  signalGroup(child.pid, "SIGTERM")
  const stopped = await Promise.race([
    childClosed.then(() => true),
    new Promise((resolveWait) => setTimeout(() => resolveWait(false), 2_000)),
  ])
  if (!stopped) {
    signalGroup(child.pid, "SIGKILL")
    await childClosed
  }
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if (error?.code !== "ESRCH") throw error
  }
}

try {
  await run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = error instanceof SupervisorError ? error.exitCode : 1
}
