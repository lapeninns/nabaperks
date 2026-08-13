import assert from "node:assert/strict"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile, spawnSync } from "node:child_process"
import { afterEach, test } from "node:test"
import { promisify } from "node:util"

const temporaryPaths = []
const execFileAsync = promisify(execFile)

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  )
})

test("Given an external Supabase origin When the admin MFA boundary is parsed Then it is rejected before Auth construction", async () => {
  const adminMfa = await import("../e2e/helpers/admin-mfa-session.ts")

  assert.equal(typeof adminMfa.requireLocalSupabaseUrl, "function")
  assert.throws(
    () => adminMfa.requireLocalSupabaseUrl("https://project.supabase.co"),
    /local Supabase/
  )
  assert.equal(
    adminMfa.requireLocalSupabaseUrl("http://127.0.0.1:54321"),
    "http://127.0.0.1:54321/"
  )
})

test("Given a remote race target When the preflight CLI runs Then no HTTP request is attempted", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-local-race-target.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        STAMP_RACE_AUTH_TOKEN: "fixture-token",
        STAMP_RACE_BODY: '{"membershipId":"fixture"}',
        STAMP_RACE_URL: "https://example.invalid/stamp",
        REDEEM_RACE_BODY: '{"token":"fixture"}',
        REDEEM_RACE_URL: "http://127.0.0.1:9/redeem",
      },
      timeout: 5_000,
    }
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /STAMP_RACE_URL must use an IPv4 loopback origin/)
  assert.doesNotMatch(result.stderr, /fetch failed/)
})

test("Given malformed or credential-injected race input When the preflight CLI runs Then it fails closed", () => {
  for (const overrides of [
    { STAMP_RACE_URL: "http://user:pass@127.0.0.1:9/stamp" },
    { STAMP_RACE_BODY: "[]" },
    { STAMP_RACE_BODY: "{}" },
    { STAMP_RACE_AUTH_TOKEN: "" },
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-local-race-target.mjs"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          STAMP_RACE_AUTH_TOKEN: "fixture-token",
          STAMP_RACE_BODY: '{"membershipId":"fixture"}',
          STAMP_RACE_URL: "http://127.0.0.1:9/stamp",
          REDEEM_RACE_BODY: '{"token":"fixture"}',
          REDEEM_RACE_URL: "http://127.0.0.1:9/redeem",
          ...overrides,
        },
        timeout: 5_000,
      }
    )

    assert.equal(result.status, 1)
  }
})

test("Given authenticated loopback endpoints When the preflight CLI runs Then both receive a bounded auth probe", async () => {
  const requests = []
  const server = createServer((request, response) => {
    requests.push({
      authorization: request.headers.authorization,
      method: request.method,
      url: request.url,
    })
    response.writeHead(204).end()
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const origin = `http://127.0.0.1:${address.port}`
    const result = await execFileAsync(
      process.execPath,
      ["scripts/check-local-race-target.mjs"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          STAMP_RACE_AUTH_TOKEN: "fixture-token",
          STAMP_RACE_BODY: '{"membershipId":"fixture"}',
          STAMP_RACE_URL: `${origin}/stamp`,
          REDEEM_RACE_BODY: '{"token":"fixture"}',
          REDEEM_RACE_URL: `${origin}/redeem`,
        },
        timeout: 5_000,
      }
    )

    assert.equal(result.stderr, "")
    assert.deepEqual(requests, [
      { authorization: "Bearer fixture-token", method: "HEAD", url: "/stamp" },
      { authorization: "Bearer fixture-token", method: "HEAD", url: "/redeem" },
    ])
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})

test("Given disposable Supabase stop When the wrapper invokes the CLI Then no-backup is explicit", async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "nabaperks-supabase-stop-"))
  temporaryPaths.push(fixtureDir)
  const argvPath = join(fixtureDir, "argv.txt")
  const fakeCliPath = join(fixtureDir, "supabase")
  await writeFile(
    fakeCliPath,
    `#!/bin/sh\nprintf '%s\\n' "$@" > "${argvPath}"\n`,
    "utf8"
  )
  await chmod(fakeCliPath, 0o700)

  const result = spawnSync(
    process.execPath,
    ["scripts/supabase-local.mjs", "stop"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PATH: `${fixtureDir}:${process.env.PATH ?? ""}` },
    }
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(await readFile(argvPath, "utf8"), "stop\n--no-backup\n")
})

test("Given equal revision prefixes with different suffixes When staging probes run Then the mismatch is rejected", async () => {
  const stagingRelease = await import("../../scripts/check-staging-release.mjs")
  assert.equal(typeof stagingRelease.proveStagingProbes, "function")
  const expectedRevision = `${"a".repeat(12)}${"b".repeat(28)}`
  const server = createServer((request, response) => {
    const body =
      request.url === "/api/health"
        ? {
            environment: "preview",
            revision: `${"a".repeat(12)}${"c".repeat(28)}`,
            scope: "liveness",
            status: "ok",
            targetEnvironment: "staging",
          }
        : {
            checks: { database: "ok" },
            environment: "preview",
            revision: `${"a".repeat(12)}${"c".repeat(28)}`,
            scope: "readiness",
            status: "ready",
            targetEnvironment: "staging",
          }
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(body))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address === "object")
    await assert.rejects(
      stagingRelease.proveStagingProbes({
        appUrl: new URL(`http://127.0.0.1:${address.port}`),
        bypassSecret: "",
        mode: "ephemeral",
        monitorSecret: "fixture-monitor-secret",
        revision: expectedRevision,
      }),
      /staging liveness revision is wrong/
    )
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})

test("Given complete matching revisions When staging probes run Then the full revision is accepted", async () => {
  const stagingRelease = await import("../../scripts/check-staging-release.mjs")
  const revision = `${"d".repeat(40)}`
  const server = createServer((request, response) => {
    const body =
      request.url === "/api/health"
        ? {
            environment: "preview",
            revision,
            scope: "liveness",
            status: "ok",
            targetEnvironment: "staging",
          }
        : {
            checks: { database: "ok" },
            environment: "preview",
            revision,
            scope: "readiness",
            status: "ready",
            targetEnvironment: "staging",
          }
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(body))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address === "object")
    await stagingRelease.proveStagingProbes({
      appUrl: new URL(`http://127.0.0.1:${address.port}`),
      bypassSecret: "",
      mode: "ephemeral",
      monitorSecret: "fixture-monitor-secret",
      revision,
    })
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
