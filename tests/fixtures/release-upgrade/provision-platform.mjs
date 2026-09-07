import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { runContainer } from "../../../ops/local-ci/agent/container.mjs"
import manifest from "../../../config/local-ci-image-manifest.json" with { type: "json" }

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const digest = (value) => createHash("sha256").update(value).digest("hex")
const EXCLUDED =
  "analytics,edge-runtime,functions,imgproxy,inbucket,kong,meta,realtime,rest,storage,studio,vector"
const readinessSql = `begin read only;
select json_build_object(
  'database',current_database(),'serverVersion',current_setting('server_version'),
  'major',current_setting('server_version_num')::int / 10000,
  'publicTables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
  'authUsers',(select count(*) from auth.users),
  'authReady',to_regclass('auth.sessions') is not null and to_regclass('auth.mfa_factors') is not null and to_regclass('auth.mfa_amr_claims') is not null and to_regclass('auth.identities') is not null and to_regprocedure('auth.uid()') is not null,
  'roles',(select json_agg(rolname order by rolname) from pg_roles where rolname in ('anon','authenticated','service_role','supabase_auth_admin','supabase_storage_admin')),
  'extensions',(select json_agg(name order by name) from pg_available_extensions where name in ('pg_cron','pg_net')),
  'cronDatabase',current_setting('cron.database_name',true),
  'netDatabase',current_setting('pg_net.database_name',true));
commit;`

export function platformPlan(
  { marker, port = 54322 },
  env = process.env,
  platform = process.platform
) {
  assert.equal(
    platform,
    "linux",
    "Provision only inside the isolated Linux job"
  )
  assert.equal(
    env.DOCKER_HOST,
    "tcp://127.0.0.1:2375",
    "Private loopback DinD required"
  )
  assert.match(
    marker ?? "",
    UUID,
    "An external UUIDv4 one-use marker is required"
  )
  assert.ok(Number.isSafeInteger(port) && port >= 1024 && port <= 65500)
  const suffix = marker.replaceAll("-", "")
  return {
    marker,
    port,
    project: `upgrade_${suffix}`,
    database: `codex_upgrade_${suffix}`,
    dbContainer: `supabase_db_upgrade_${suffix}`,
  }
}

export function platformConfig(plan) {
  return `project_id = "${plan.project}"
[api]
enabled = false
port = ${plan.port - 1}
[db]
port = ${plan.port}
shadow_port = ${plan.port + 1}
major_version = 17
health_timeout = "2m"
[db.migrations]
enabled = false
schema_paths = []
[db.seed]
enabled = false
sql_paths = []
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
[storage]
enabled = true
[realtime]
enabled = false
[studio]
enabled = false
[inbucket]
enabled = false
[analytics]
enabled = false
[edge_runtime]
enabled = false
`
}

export function assertPlatformReadiness(actual, database) {
  assert.equal(actual.database, database)
  assert.equal(actual.major, 17)
  assert.equal(
    actual.publicTables,
    0,
    "Platform must contain no application tables"
  )
  assert.equal(actual.authUsers, 0, "Platform must contain no people")
  assert.equal(
    actual.authReady,
    true,
    "Authentic migrated Auth/MFA schema required"
  )
  assert.deepEqual(actual.roles, [
    "anon",
    "authenticated",
    "service_role",
    "supabase_auth_admin",
    "supabase_storage_admin",
  ])
  assert.deepEqual(actual.extensions, ["pg_cron", "pg_net"])
}

// No command output is logged: Supabase start/status can print synthetic keys.
export async function runPlatformCommand(
  commandName,
  args,
  { cwd, env, signal, timeoutMs = 120000, input } = {}
) {
  let stdout = ""
  let stdoutBytes = 0
  let stdoutOverflow = false
  const result = await runContainer([commandName, ...args], {
    signal,
    timeoutMs,
    spawnFn: (executable, argv, options) => {
      const child = spawn(executable, argv, {
        ...options,
        cwd,
        env,
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      })
      if (input !== undefined) {
        child.stdin.on("error", () => {})
        child.stdin.end(input)
      }
      return child
    },
    onOutput: (chunk, stream) => {
      if (stream === "stdout") {
        stdoutBytes += Buffer.byteLength(chunk)
        if (stdoutBytes > 4 * 1024 * 1024) stdoutOverflow = true
        else stdout += chunk
      }
    },
  })
  signal?.throwIfAborted()
  assert.ok(
    result.exitCode === 0 &&
      !result.timedOut &&
      !result.cancelled &&
      !result.truncated &&
      !stdoutOverflow,
    `Platform ${commandName} failed; no proof produced`
  )
  return stdout.trim()
}

export async function withPristinePlatform(
  options,
  operation,
  {
    run = runPlatformCommand,
    env = process.env,
    platform = process.platform,
    signal,
  } = {}
) {
  const plan = platformPlan(options, env, platform)
  const temporary = mkdtempSync(join(tmpdir(), "upgrade-platform-"))
  const environment = {
    PATH: env.PATH,
    HOME: temporary,
    LANG: "C.UTF-8",
    DOCKER_HOST: env.DOCKER_HOST,
  }
  const invoke = (name, args, extra = {}) =>
    run(name, args, { cwd: temporary, env: environment, signal, ...extra })
  const docker = (args, extra) => invoke("docker", args, extra)
  const sql = (database, input) =>
    docker(
      [
        "exec",
        "-i",
        plan.dbContainer,
        "psql",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        database,
      ],
      { input }
    )
  let started = false
  try {
    assert.equal(
      await invoke("supabase", ["--version"]),
      manifest.supabaseCliVersion,
      "Pinned Supabase CLI required"
    )
    assert.equal(
      await docker(["ps", "-aq"]),
      "",
      "DinD must start with no containers"
    )
    assert.equal(
      await docker(["volume", "ls", "-q"]),
      "",
      "DinD must start with no volumes"
    )
    for (const image of manifest.images) {
      assert.equal(
        await docker(["image", "inspect", "--format", "{{.Id}}", image.tag]),
        image.configDigest,
        "Preloaded reviewed image required"
      )
    }
    mkdirSync(join(temporary, "supabase"))
    const config = platformConfig(plan)
    writeFileSync(join(temporary, "supabase/config.toml"), config, {
      mode: 0o600,
    })
    started = true
    await invoke(
      "supabase",
      ["start", "--workdir", temporary, "--exclude", EXCLUDED],
      { timeoutMs: 600000 }
    )
    const names = (await docker(["ps", "-a", "--format", "{{.Names}}"]))
      .split("\n")
      .filter(Boolean)
    assert.ok(
      names.includes(plan.dbContainer),
      "Owned platform database required"
    )
    const imageIds = new Set(manifest.images.map((image) => image.configDigest))
    for (const name of names) {
      assert.ok(
        name.endsWith(`_${plan.project}`) && name.startsWith("supabase_"),
        "Unexpected container in disposable daemon"
      )
      assert.ok(
        imageIds.has(await docker(["inspect", "--format", "{{.Image}}", name])),
        "Started platform image is not reviewed"
      )
    }
    const bootstrap = JSON.parse(await sql("postgres", readinessSql))
    assertPlatformReadiness(bootstrap, "postgres")
    for (const name of names.filter((name) => name !== plan.dbContainer))
      await docker(["stop", "--time", "10", name])
    // A template clone preserves the authentic platform schemas and ownership.
    // Only this fresh project's blank postgres is quiesced, from template1.
    await sql(
      "template1",
      `alter database postgres allow_connections false;
select pg_terminate_backend(pid) from pg_stat_activity where datname='postgres';
create database ${plan.database} with template postgres owner postgres;
alter database postgres allow_connections true;`
    )
    await sql(
      "template1",
      `alter system set cron.database_name = '${plan.database}';`
    )
    await sql(
      "template1",
      `alter system set pg_net.database_name = '${plan.database}';`
    )
    await docker(["restart", "--time", "10", plan.dbContainer])
    await docker(
      [
        "exec",
        plan.dbContainer,
        "sh",
        "-c",
        'for n in $(seq 1 60); do pg_isready -U postgres -d "$1" >/dev/null && exit 0; sleep 1; done; exit 1',
        "platform-ready",
        plan.database,
      ],
      { timeoutMs: 70000 }
    )
    const target = JSON.parse(await sql(plan.database, readinessSql))
    assertPlatformReadiness(target, plan.database)
    assert.equal(target.cronDatabase, plan.database)
    assert.equal(target.netDatabase, plan.database)
    const schema = await docker([
      "exec",
      plan.dbContainer,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      plan.database,
      "--schema-only",
      "--no-owner",
      "--no-privileges",
    ])
    await sql(
      plan.database,
      `create schema codex_upgrade_guard;
create table codex_upgrade_guard.target(marker uuid primary key, consumed boolean not null default false);
insert into codex_upgrade_guard.target(marker) values('${plan.marker}'::uuid);`
    )
    const status = JSON.parse(
      await invoke("supabase", ["status", "--workdir", temporary, "-o", "json"])
    )
    const databaseUrl = new URL(status.DB_URL)
    assert.ok(["postgres:", "postgresql:"].includes(databaseUrl.protocol))
    assert.equal(databaseUrl.hostname, "127.0.0.1")
    assert.equal(databaseUrl.port, String(plan.port))
    assert.equal(databaseUrl.pathname, "/postgres")
    assert.equal(databaseUrl.search + databaseUrl.hash, "")
    databaseUrl.pathname = `/${plan.database}`
    const targetPath = join(temporary, "target.json")
    writeFileSync(
      targetPath,
      JSON.stringify({ databaseUrl: databaseUrl.href, marker: plan.marker }),
      { mode: 0o600 }
    )
    const evidence = {
      schema: "nabaperks.upgrade-platform.v1",
      project: plan.project,
      database: plan.database,
      marker: plan.marker,
      nodeVersion: process.version,
      supabaseCliVersion: manifest.supabaseCliVersion,
      dockerVersion: await docker([
        "version",
        "--format",
        "{{.Server.Version}}",
      ]),
      platform: target,
      configDigest: digest(config),
      bootstrapSchemaDigest: digest(schema),
      imageManifestDigest: digest(JSON.stringify(manifest)),
      pristine: true,
    }
    return {
      evidence,
      result: await operation({
        targetPath,
        databaseUrl: databaseUrl.href,
        marker: plan.marker,
        environment,
        temporary,
        signal,
      }),
    }
  } finally {
    try {
      if (started)
        await invoke(
          "supabase",
          [
            "stop",
            "--project-id",
            plan.project,
            "--no-backup",
            "--workdir",
            temporary,
          ],
          { signal: undefined, timeoutMs: 60000 }
        )
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  }
}

async function main(config) {
  assert.equal(resolve(config.upgradeConfigPath), config.upgradeConfigPath)
  assert.equal(resolve(config.evidencePath), config.evidencePath)
  assert.ok(!existsSync(config.evidencePath), "Evidence output must be new")
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.once("SIGINT", cancel)
  process.once("SIGTERM", cancel)
  try {
    const outcome = await withPristinePlatform(
      config,
      async ({ targetPath, environment, temporary, signal }) => {
        const target = JSON.parse(readFileSync(targetPath, "utf8"))
        const upgrade = {
          ...JSON.parse(readFileSync(config.upgradeConfigPath, "utf8")),
          ...target,
        }
        const upgradePath = join(temporary, "upgrade.json")
        writeFileSync(upgradePath, JSON.stringify(upgrade), { mode: 0o600 })
        const output = await runPlatformCommand(
          process.execPath,
          [
            fileURLToPath(
              new URL(
                "../../../scripts/release/populated-upgrade.mjs",
                import.meta.url
              )
            ),
            upgradePath,
          ],
          {
            cwd: temporary,
            env: {
              PATH: environment.PATH,
              LANG: environment.LANG,
              UPGRADE_DATABASE_URL: target.databaseUrl,
            },
            signal,
            timeoutMs: 1800000,
          }
        )
        return JSON.parse(output)
      },
      { signal: controller.signal }
    )
    writeFileSync(
      config.evidencePath,
      JSON.stringify(outcome, null, 2) + "\n",
      { mode: 0o600, flag: "wx" }
    )
    console.log(
      JSON.stringify({ evidencePath: config.evidencePath, result: "success" })
    )
  } finally {
    process.removeListener("SIGINT", cancel)
    process.removeListener("SIGTERM", cancel)
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(process.argv.length, 3)
    await main(JSON.parse(readFileSync(process.argv[2], "utf8")))
  } catch {
    console.error(
      "Disposable platform provisioning failed; no compatibility proof produced."
    )
    process.exitCode = 1
  }
}
