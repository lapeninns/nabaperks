import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import {
  runSupabaseMigrationList,
  parseRemoteMigrationVersions,
} from "../check-supabase-migrations.mjs"
import { migrationDelta } from "./populated-upgrade.mjs"

export function verifyMigrationPrefix(baseline, candidate, remoteVersions) {
  migrationDelta(baseline, candidate)
  const versions = candidate.map((entry) => entry.name.slice(0, 14))
  assert.ok(
    remoteVersions.length >= baseline.length &&
      remoteVersions.length <= candidate.length,
    "Production migration count is outside qualified baseline/candidate bounds"
  )
  assert.deepEqual(
    remoteVersions,
    versions.slice(0, remoteVersions.length),
    "Production migrations are not a contiguous qualified prefix"
  )
  return {
    applied: remoteVersions.length,
    pending: candidate.length - remoteVersions.length,
  }
}

export function readMigrations(revision, cwd = process.cwd()) {
  assert.match(revision ?? "", /^[a-f0-9]{40}$/)
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    })
  assert.equal(git(["rev-parse", `${revision}^{commit}`]).trim(), revision)
  return git([
    "ls-tree",
    "-r",
    "--name-only",
    revision,
    "--",
    "supabase/migrations",
  ])
    .trim()
    .split("\n")
    .filter((path) => path.endsWith(".sql"))
    .sort()
    .map((path) => ({
      name: path.split("/").at(-1),
      contents: git(["show", `${revision}:${path}`]),
    }))
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(process.argv.length, 3)
    const result = runSupabaseMigrationList(process.cwd(), process.env)
    assert.equal(result.status, 0, "Production migration readback failed")
    const proof = verifyMigrationPrefix(
      readMigrations(process.argv[2]),
      readMigrations(process.env.EXPECTED_REVISION),
      parseRemoteMigrationVersions(result.output)
    )
    console.log(JSON.stringify(proof))
  } catch (error) {
    console.error(`Migration admission failed: ${error.message}`)
    process.exitCode = 1
  }
}
