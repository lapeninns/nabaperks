import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const PROJECT_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const SUPERVISOR = join(
  PROJECT_ROOT,
  "tests/support/task21-playwright-server-supervisor.mjs"
)

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === "object")
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

async function waitForResponse(url, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch (error) {
      if (!(error instanceof TypeError)) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`timed out waiting for ${url}`)
}

async function waitForNoResponse(url, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url)
    } catch (error) {
      if (error instanceof TypeError) return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`timed out waiting for ${url} to close`)
}

function startSupervisor(fixture, appPort, readyPort) {
  return spawn(process.execPath, [SUPERVISOR], {
    cwd: PROJECT_ROOT,
    detached: true,
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${appPort}`,
      TASK21_PLAYWRIGHT_READY_PORT: String(readyPort),
      TASK21_SERVER_FIXTURE: fixture,
      TASK21_SERVER_HEALTH_TIMEOUT_MS: "3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
}

test("Given a healthy exact-SHA child When supervised Then readiness opens only after identity proof and signal cleanup closes both ports", async () => {
  const appPort = await availablePort()
  const readyPort = await availablePort()
  const child = startSupervisor("healthy", appPort, readyPort)
  const chunks = []
  child.stdout.on("data", (chunk) => chunks.push(chunk))
  child.stderr.on("data", (chunk) => chunks.push(chunk))

  const response = await waitForResponse(
    `http://127.0.0.1:${readyPort}/task21-ready`
  )
  const receipt = await response.json()
  assert.equal(receipt.status, "ready")
  assert.match(receipt.revision, /^[0-9a-f]{40}$/)
  assert.match(Buffer.concat(chunks).toString(), /TASK21_SERVER_READY/)
  assert.match(Buffer.concat(chunks).toString(), /heapMb=32768/)

  process.kill(-child.pid, "SIGTERM")
  const [code, signal] = await once(child, "close")
  assert.equal(signal, null)
  assert.equal(code, 0)
  await assert.rejects(fetch(`http://127.0.0.1:${appPort}/api/health`))
  await assert.rejects(fetch(`http://127.0.0.1:${readyPort}/task21-ready`))
})

test("Given a stale child revision When supervised Then the readiness gate never opens", async () => {
  const appPort = await availablePort()
  const readyPort = await availablePort()
  const child = startSupervisor("wrong-sha", appPort, readyPort)
  const stderr = []
  child.stderr.on("data", (chunk) => stderr.push(chunk))

  const [code] = await once(child, "close")

  assert.equal(code, 65)
  assert.match(Buffer.concat(stderr).toString(), /TASK21_HEALTH_SHA_MISMATCH/)
  await assert.rejects(fetch(`http://127.0.0.1:${readyPort}/task21-ready`))
})

test("Given malformed supervisor environment When started Then it fails closed before binding", async () => {
  const result = spawn(process.execPath, [SUPERVISOR], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: "https://example.com",
      TASK21_PLAYWRIGHT_READY_PORT: "prompt: open port",
      TASK21_SERVER_FIXTURE: "healthy",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const stderr = []
  result.stderr.on("data", (chunk) => stderr.push(chunk))

  const [code] = await once(result, "close")

  assert.equal(code, 64)
  assert.match(Buffer.concat(stderr).toString(), /TASK21_INVALID_BASE_URL/)
})

test("Given Playwright is interrupted When its parent exits Then the orphaned supervisor closes both ports", async () => {
  const appPort = await availablePort()
  const readyPort = await availablePort()
  const launcher = spawn(
    process.execPath,
    [
      "--eval",
      `const {spawn}=require("node:child_process");spawn(process.execPath,[process.argv[1]],{detached:true,env:process.env,stdio:"ignore"});setTimeout(()=>process.exit(0),1000)`,
      SUPERVISOR,
    ],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${appPort}`,
        TASK21_PLAYWRIGHT_READY_PORT: String(readyPort),
        TASK21_SERVER_FIXTURE: "healthy",
        TASK21_SERVER_HEALTH_TIMEOUT_MS: "3000",
      },
      stdio: "ignore",
    }
  )

  await waitForResponse(`http://127.0.0.1:${readyPort}/task21-ready`)
  await once(launcher, "close")
  await waitForNoResponse(`http://127.0.0.1:${appPort}/api/health`)
  await waitForNoResponse(`http://127.0.0.1:${readyPort}/task21-ready`)
})
