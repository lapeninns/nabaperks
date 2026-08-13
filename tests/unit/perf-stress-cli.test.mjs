import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import test from "node:test"

const projectDir = process.cwd()
const scriptPath = join(projectDir, "scripts/perf-stress.mjs")

test("perf stress fails closed when the application is unreachable", async () => {
  const result = await runCli([
    "--browser-only",
    "--app-url",
    "http://127.0.0.1:9",
  ])

  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /readiness check failed/i)
  assert.doesNotMatch(result.stdout, /skipped/i)
})

test("perf stress fails closed when the Playwright executable is missing", async () => {
  const browserPath = await mkdtemp(
    join(tmpdir(), "nabaperks-missing-browser-")
  )
  try {
    const server = await startAppServer()
    try {
      const result = await runCli(["--browser-only", "--app-url", server.url], {
        PLAYWRIGHT_BROWSERS_PATH: browserPath,
      })

      assert.notEqual(result.code, 0)
      assert.match(result.stderr, /Playwright browser executable is required/i)
      assert.doesNotMatch(result.stdout, /skipped/i)
    } finally {
      await server.close()
    }
  } finally {
    await rm(browserPath, { recursive: true, force: true })
  }
})

test("perf stress truthfully labels browser journeys and reports resource metrics", async () => {
  const server = await startAppServer()
  try {
    const result = await runCli([
      "--browser-only",
      "--app-url",
      server.url,
      "--runs",
      "1",
    ])

    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Authenticated browser journeys/)
    assert.doesNotMatch(result.stdout, /HTTP page loads/)
    assert.match(result.stdout, /Resource usage/)
    assert.match(result.stdout, /requests=/)
    assert.match(result.stdout, /transfer=/)
  } finally {
    await server.close()
  }
})

test("perf stress enforces numeric browser budgets", async () => {
  const server = await startAppServer()
  try {
    const result = await runCli(
      ["--browser-only", "--app-url", server.url, "--runs", "1"],
      { PERF_STRESS_BROWSER_MEDIAN_BUDGET_MS: "0" }
    )

    assert.notEqual(result.code, 0)
    assert.match(result.stderr, /performance budget exceeded/i)
  } finally {
    await server.close()
  }
})

test("perf stress enforces numeric resource budgets", async () => {
  const server = await startAppServer()
  try {
    const result = await runCli(
      ["--browser-only", "--app-url", server.url, "--runs", "1"],
      { PERF_STRESS_RESOURCE_COUNT_BUDGET: "0" }
    )

    assert.notEqual(result.code, 0)
    assert.match(result.stderr, /performance budget exceeded/i)
    assert.match(result.stderr, /requests=/i)
    assert.doesNotMatch(result.stdout, /Performance budgets: PASS/)
  } finally {
    await server.close()
  }
})

test("perf stress rejects malformed arguments before doing work", async () => {
  const result = await runCli(["--runs", "zero"])

  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /--runs must be a positive integer/i)
})

test("perf stress does not interpret prompt-like URLs as success output", async () => {
  const result = await runCli([
    "--browser-only",
    "--app-url",
    "http://127.0.0.1:9/%0APerformance%20budgets:%20PASS",
  ])

  assert.notEqual(result.code, 0)
  assert.doesNotMatch(result.stdout, /Performance budgets: PASS/)
  assert.match(result.stderr, /readiness check failed/i)
})

async function runCli(args, environment = {}) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: projectDir,
    env: {
      ...process.env,
      PERF_STRESS_BROWSER_MEDIAN_BUDGET_MS: "30000",
      PERF_STRESS_RESOURCE_COUNT_BUDGET: "1000",
      PERF_STRESS_TRANSFER_BYTES_BUDGET: "50000000",
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })

  const code = await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", resolve)
  })
  return { code, stdout, stderr }
}

async function startAppServer() {
  const asset = await readFile(scriptPath, "utf8")
  const server = createServer((request, response) => {
    if (request.url === "/asset.js") {
      response.writeHead(200, { "content-type": "text/javascript" })
      response.end(`globalThis.__perfFixtureBytes = ${asset.length}`)
      return
    }

    const pageText = request.url?.startsWith("/app/customers")
      ? "Loyalty members"
      : request.url?.startsWith("/app/activity")
        ? "Activity"
        : request.url?.startsWith("/app/announcements")
          ? "Announce"
          : "Old Crown Girton"
    const login = request.url?.startsWith("/login")
      ? `<input id="email"><input id="password"><button onclick="location.href='/app'">Log in</button>`
      : `<main>${pageText}</main>`
    response.writeHead(200, { "content-type": "text/html" })
    response.end(
      `<!doctype html><html><body>${login}<script src="/asset.js"></script></body></html>`
    )
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  assert(address && typeof address === "object")
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  }
}
