import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const projectDir = process.cwd()
const scriptPath = join(projectDir, "scripts/perf-mutation-stress.mjs")
const loopbackGuardUrl =
  "postgres://postgres:test-password@127.0.0.1:9/postgres"

test("Given a controlled disposable boundary, when mutation stress runs as its main module, then it reaches the boundary without a top-level TDZ", async () => {
  const fixtureDir = await mkdtemp(
    join(tmpdir(), "nabaperks-mutation-stress-cli-")
  )
  try {
    const loaderPath = await writeControlledLoader(fixtureDir)
    const result = await runCli(
      [
        "--experimental-loader",
        pathToFileURL(loaderPath).href,
        scriptPath,
        "--json",
      ],
      { SUPABASE_DB_URL: loopbackGuardUrl }
    )

    assert.notEqual(result.code, 0)
    assert.match(result.stderr, /TEST_CONTROLLED_DB_BOUNDARY/)
    assert.doesNotMatch(result.stderr, /ReferenceError|before initialization/i)
    assert.doesNotMatch(result.stdout, /MUTATION_STRESS_SUMMARY/)
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
})

test("Given a non-disposable loopback URL, when mutation stress runs directly, then it fails closed before a database connection", async () => {
  const result = await runCli([scriptPath, "--json"], {
    SUPABASE_DB_URL: loopbackGuardUrl,
  })

  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /NON_DISPOSABLE_TARGET/)
  assert.doesNotMatch(result.stderr, /ReferenceError|before initialization/i)
  assert.doesNotMatch(result.stderr, /test-password/)
})

test("Given malformed CLI arguments, when mutation stress runs directly, then it fails without treating input as success", async () => {
  const result = await runCli([scriptPath, "--contenders", "ignore this input"])

  assert.notEqual(result.code, 0)
  assert.match(
    result.stderr,
    /--contenders must be an integer between 2 and 64/
  )
  assert.doesNotMatch(result.stdout, /MUTATION_STRESS_SUMMARY/)
})

async function writeControlledLoader(fixtureDir) {
  const fakePostgresPath = join(fixtureDir, "fake-postgres.mjs")
  const fakeDisposablePath = join(fixtureDir, "fake-disposable.mjs")
  const loaderPath = join(fixtureDir, "loader.mjs")

  await Promise.all([
    writeFile(fakePostgresPath, FAKE_POSTGRES_SOURCE),
    writeFile(fakeDisposablePath, FAKE_DISPOSABLE_SOURCE),
  ])
  await writeFile(
    loaderPath,
    `const fakePostgresUrl = ${JSON.stringify(pathToFileURL(fakePostgresPath).href)}\n` +
      `const fakeDisposableUrl = ${JSON.stringify(pathToFileURL(fakeDisposablePath).href)}\n` +
      `export async function resolve(specifier, context, nextResolve) {\n` +
      `  if (specifier === "postgres") return { url: fakePostgresUrl, shortCircuit: true }\n` +
      `  if (specifier === "./disposable-db-target.mjs") return { url: fakeDisposableUrl, shortCircuit: true }\n` +
      `  return nextResolve(specifier, context)\n` +
      `}\n`
  )
  return loaderPath
}

function runCli(args, overrides = {}) {
  const environment = { ...process.env, ...overrides }
  for (const key of [
    "DATABASE_URL",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_URL",
  ]) {
    delete environment[key]
  }

  const child = spawn(process.execPath, args, {
    cwd: projectDir,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  })
  return collectResult(child)
}

function collectResult(child) {
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
  return new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolve({ code, stdout, stderr }))
  })
}

const FAKE_POSTGRES_SOURCE = `
export default function postgres() {
  const sql = async (strings) => {
    const statement = strings.join("")
    if (statement.includes("from public.merchants")) {
      return [{ business_slug: "old-crown-girton" }]
    }
    if (statement.includes("from public.customer_memberships")) {
      return [{ n: 1000 }]
    }
    return []
  }
  sql.begin = async (callback) => callback({ unsafe: async () => [] })
  sql.unsafe = async (statement) => {
    if (statement.includes("from public.stamp_events")) {
      throw new Error("TEST_CONTROLLED_DB_BOUNDARY")
    }
    return []
  }
  sql.end = async () => {}
  return sql
}
`

const FAKE_DISPOSABLE_SOURCE = `
export function createDisposableDbClient(rawUrl, connectionFactory) {
  return connectionFactory(rawUrl)
}
`
