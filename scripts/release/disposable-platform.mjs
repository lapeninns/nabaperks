import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// The provisioner owns only a random blank Supabase project. No repository
// config, seed, provider key, or host database environment enters its children.
export function provisionDisposablePlatform() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "upgrade-platform-")))
  const marker = randomUUID()
  // Supabase truncates project identifiers at 40 characters. Keep the full
  // random identity within that limit so ownership and container names agree.
  const project = `upgrade-${marker.replaceAll("-", "")}`
  const database = `codex_upgrade_${marker.replaceAll("-", "")}`
  const env = { PATH: process.env.PATH, HOME: root, CI: "1", DO_NOT_TRACK: "1" }
  function execute(command, args, input) {
    const result = spawnSync(command, args, {
      env,
      cwd: root,
      input,
      timeout: 600_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    assert.ok(
      !result.error && !result.signal && result.status === 0,
      `Disposable platform ${command} failed`
    )
    return result.stdout
  }
  execute("supabase", ["init", "--workdir", root])
  const config = join(root, "supabase/config.toml")
  const original = readFileSync(config, "utf8")
  assert.match(original, /^project_id = ".+"/m)
  writeFileSync(
    config,
    original
      .replace(/^project_id = ".+"/m, `project_id = "${project}"`)
      .replace(/\b5432([0-9])\b/g, "5549$1")
  )
  let started = false
  const stop = () => {
    // Never substitute another config/project when removing owned resources.
    assert.match(
      readFileSync(config, "utf8"),
      new RegExp(`^project_id = "${project}"$`, "m")
    )
    if (started) execute("supabase", ["stop", "--no-backup", "--workdir", root])
  }
  try {
    started = true
    execute("supabase", [
      "start",
      "--workdir",
      root,
      "--exclude",
      "studio,meta,realtime,analytics,vector,imgproxy,edge-runtime,inbucket",
    ])
    const container = `supabase_db_${project}`
    const docker = (...args) => execute("docker", ["exec", container, ...args])
    const pristine = docker(
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-qAt",
      "-c",
      "select (select count(*) from auth.users) + (select count(*) from pg_tables where schemaname='public');"
    )
    assert.equal(pristine.toString().trim(), "0", "Platform is not empty")
    const dump = docker("pg_dump", "-U", "supabase_admin", "-Fc", "postgres")
    docker("createdb", "-U", "supabase_admin", "-O", "postgres", database)
    execute(
      "docker",
      [
        "exec",
        "-i",
        container,
        "pg_restore",
        "-U",
        "supabase_admin",
        "--exit-on-error",
        "-d",
        database,
      ],
      dump
    )
    execute(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
      ],
      `create schema codex_upgrade_guard; create table codex_upgrade_guard.target(marker uuid primary key, consumed boolean not null default false); insert into codex_upgrade_guard.target(marker) values ('${marker}');`
    )
    return {
      marker,
      databaseUrl: `postgresql://postgres:postgres@127.0.0.1:55492/${database}`,
      stop,
    }
  } catch (error) {
    try {
      stop()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Platform startup and cleanup failed"
      )
    }
    throw error
  }
}
