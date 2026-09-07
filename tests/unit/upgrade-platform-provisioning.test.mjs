import assert from "node:assert/strict"
import { readFileSync, statSync, existsSync } from "node:fs"
import test from "node:test"
import {
  runPlatformCommand,
  platformPlan,
  platformConfig,
  assertPlatformReadiness,
  withPristinePlatform,
} from "../fixtures/release-upgrade/provision-platform.mjs"
import manifest from "../../config/local-ci-image-manifest.json" with { type: "json" }

const marker = "ee000000-0000-4000-8000-000000000001"
const environment = {
  PATH: process.env.PATH,
  DOCKER_HOST: "tcp://127.0.0.1:2375",
  SUPABASE_ACCESS_TOKEN: "forbidden-fixture",
}
const plan = platformPlan({ marker }, environment, "linux")
const ready = (database) => ({
  database,
  major: 17,
  serverVersion: "17.6",
  publicTables: 0,
  authUsers: 0,
  authReady: true,
  roles: [
    "anon",
    "authenticated",
    "service_role",
    "supabase_auth_admin",
    "supabase_storage_admin",
  ],
  extensions: ["pg_cron", "pg_net"],
  cronDatabase: database,
  netDatabase: database,
})
function runner(override = () => undefined) {
  const calls = []
  return {
    calls,
    run: async (name, args, options) => {
      calls.push({ name, args, options })
      const alternate = override(name, args, options)
      if (alternate !== undefined) return alternate
      if (args[0] === "--version") return manifest.supabaseCliVersion
      if (args[0] === "image")
        return manifest.images.find((image) => image.tag === args.at(-1))
          .configDigest
      if (args[0] === "inspect") return manifest.images[0].configDigest
      if (args[0] === "ps" && args.includes("--format"))
        return `${plan.dbContainer}\nsupabase_auth_${plan.project}`
      if (options.input?.includes("begin read only"))
        return JSON.stringify(ready(args.at(-1)))
      if (args[0] === "status")
        return JSON.stringify({
          DB_URL: "postgresql://postgres:synthetic@127.0.0.1:54322/postgres",
        })
      if (args.includes("pg_dump")) return "CREATE SCHEMA auth;"
      if (args[0] === "version") return "27.5.1"
      return ""
    },
  }
}

test("platform requires Linux private loopback DinD and external UUIDv4 marker", () => {
  for (const bad of [
    "unix:///var/run/docker.sock",
    "tcp://production.example:2375",
    "tcp://127.0.0.1:2376",
    undefined,
  ])
    assert.throws(() => platformPlan({ marker }, { DOCKER_HOST: bad }, "linux"))
  assert.throws(() => platformPlan({ marker }, environment, "darwin"))
  for (const bad of [undefined, "bad", marker.replace("-4000-", "-1000-")])
    assert.throws(() => platformPlan({ marker: bad }, environment, "linux"))
  const config = platformConfig(plan)
  assert.match(config, /\[db.migrations\]\nenabled = false/)
  assert.match(config, /\[db.seed\]\nenabled = false\nsql_paths = \[\]/)
  assert.match(config, /\[auth\]\nenabled = true/)
  assert.doesNotMatch(config, /env\(|\.\.\/|migrations\//)
})

test("read-only bootstrap acceptance requires empty public/auth, MFA schemas, roles and extensions", () => {
  assertPlatformReadiness(ready(plan.database), plan.database)
  for (const mutation of [
    { publicTables: 1 },
    { authUsers: 1 },
    { authReady: false },
    { major: 16 },
    { database: "postgres" },
    { roles: ["postgres"] },
    { extensions: [] },
  ])
    assert.throws(() =>
      assertPlatformReadiness(
        { ...ready(plan.database), ...mutation },
        plan.database
      )
    )
})

test("pristine clone is guarded, target config is private and all resources tear down after callback", async () => {
  const { run, calls } = runner()
  let targetPath
  const outcome = await withPristinePlatform(
    { marker },
    async (target) => {
      targetPath = target.targetPath
      assert.equal(statSync(targetPath).mode & 0o777, 0o600)
      assert.equal(JSON.parse(readFileSync(targetPath, "utf8")).marker, marker)
      assert.ok(target.databaseUrl.endsWith(`/${plan.database}`))
      assert.equal(target.environment.SUPABASE_ACCESS_TOKEN, undefined)
      return { verified: true }
    },
    { run, env: environment, platform: "linux" }
  )
  assert.deepEqual(outcome.result, { verified: true })
  assert.match(outcome.evidence.bootstrapSchemaDigest, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(outcome).includes("synthetic"), false)
  assert.equal(existsSync(targetPath), false)
  const statements = calls.map((call) => call.options.input ?? "").join("\n")
  assert.match(
    statements,
    /alter database postgres allow_connections false;[\s\S]*create database codex_upgrade_[a-f0-9]+ with template postgres owner postgres;/
  )
  assert.match(
    statements,
    /create table codex_upgrade_guard.target\(marker uuid primary key, consumed boolean not null default false\)/
  )
  assert.match(statements, /alter system set cron.database_name/)
  assert.match(statements, /alter system set pg_net.database_name/)
  assert.deepEqual(calls.at(-1).args.slice(0, 4), [
    "stop",
    "--project-id",
    plan.project,
    "--no-backup",
  ])
  assert.equal(
    calls.some((call) => call.args.includes("--all")),
    false
  )
})

test("existing containers or volumes refuse before start and are never cleaned", async () => {
  for (const blocked of ["ps", "volume"]) {
    const { run, calls } = runner((_name, args) =>
      args[0] === blocked ? "foreign" : undefined
    )
    await assert.rejects(
      withPristinePlatform({ marker }, () => assert.fail(), {
        run,
        env: environment,
        platform: "linux",
      })
    )
    assert.equal(
      calls.some((call) => ["start", "stop"].includes(call.args[0])),
      false
    )
  }
})

test("failed start, failed bootstrap and callback exception still remove only this project", async () => {
  for (const failure of ["start", "bootstrap", "callback"]) {
    const { run, calls } = runner((_name, args, options) => {
      if (failure === "start" && args[0] === "start")
        throw new Error("start failed")
      if (failure === "bootstrap" && options.input?.includes("begin read only"))
        return JSON.stringify({ ...ready("postgres"), authUsers: 1 })
    })
    await assert.rejects(
      withPristinePlatform(
        { marker },
        () => {
          throw new Error("callback failed")
        },
        { run, env: environment, platform: "linux" }
      )
    )
    assert.deepEqual(calls.at(-1).args.slice(0, 4), [
      "stop",
      "--project-id",
      plan.project,
      "--no-backup",
    ])
    assert.equal(calls.at(-1).options.signal, undefined)
    assert.equal(existsSync(calls.at(-1).options.cwd), false)
  }
})

test("cancellation never suppresses scoped cleanup", async () => {
  const controller = new AbortController()
  const { run, calls } = runner((_name, args) => {
    if (args[0] === "start") {
      controller.abort()
      controller.signal.throwIfAborted()
    }
  })
  await assert.rejects(
    withPristinePlatform({ marker }, () => assert.fail(), {
      run,
      env: environment,
      platform: "linux",
      signal: controller.signal,
    }),
    { name: "AbortError" }
  )
  assert.equal(calls.at(-1).options.signal, undefined)
  assert.equal(calls.at(-1).args[0], "stop")
})

test("platform command rejects stdout overflow rather than hashing a partial schema", async () => {
  await assert.rejects(
    runPlatformCommand(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(5 * 1024 * 1024))"],
      { timeoutMs: 5000 }
    ),
    /failed; no proof/
  )
  assert.equal(
    await runPlatformCommand(
      process.execPath,
      ["-e", "process.stdout.write('complete')"],
      { timeoutMs: 5000 }
    ),
    "complete"
  )
})
