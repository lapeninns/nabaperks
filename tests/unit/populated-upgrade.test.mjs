import test from "node:test"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import {
  runPopulatedUpgrade,
  probeTreeDigest,
  validateProbeArtifact,
  transactionalMigration,
  validateDisposableTarget,
  migrationDelta,
  validateProbeResult,
} from "../../scripts/release/populated-upgrade.mjs"
const marker = "ee000000-0000-4000-8000-000000000001"
const url = "postgres://postgres:fixture@127.0.0.1:54322/codex_upgrade_unit"
test("upgrade only accepts explicit disposable loopback targets without provider credentials", () => {
  assert.equal(validateDisposableTarget(url, marker, {}).hostname, "127.0.0.1")
  for (const bad of [
    url.replace("127.0.0.1", "db.production.supabase.co"),
    url.replace("codex_upgrade_unit", "postgres"),
    url + "?host=production",
    url.replace("127.0.0.1", "localhost"),
  ])
    assert.throws(() => validateDisposableTarget(bad, marker, {}))
  assert.throws(() => validateDisposableTarget(url, "", {}))
  for (const env of [
    { SUPABASE_ACCESS_TOKEN: "secret" },
    { STRIPE_SECRET_KEY: "secret" },
    { PGHOST: "production" },
    { DATABASE_URL: url },
  ])
    assert.throws(() => validateDisposableTarget(url, marker, env))
})
test("candidate must preserve exact ordered baseline migration bytes", () => {
  const baseline = [
    { name: "20260101000000_first.sql", contents: "select 1;\n" },
  ]
  const next = { name: "20260102000000_next.sql", contents: "select 2;\n" }
  assert.deepEqual(migrationDelta(baseline, [...baseline, next]), [next])
  assert.throws(
    () => migrationDelta(baseline, [{ ...baseline[0], contents: "select 1;" }]),
    /bytes/
  )
  assert.throws(() => migrationDelta(baseline, []))
  assert.throws(() => migrationDelta(baseline, [next, ...baseline]), /prefix/)
})
test("app proof requires exact revision schema challenge and all executed contracts", () => {
  const revision = "a".repeat(40),
    digest = "b".repeat(64),
    challenge = "c".repeat(64)
  const result = {
    revision,
    migrationDigest: digest,
    challenge,
    result: "success",
    checks: ["billing", "loyalty", "webhook"].map((contract) => ({
      contract,
      assertions: 1,
    })),
  }
  assert.equal(validateProbeResult(result, revision, digest, challenge), result)
  for (const changed of [
    { revision: "d".repeat(40) },
    { migrationDigest: "e".repeat(64) },
    { challenge: "old" },
    { checks: [] },
    { result: "failure" },
    {
      checks: [
        { contract: "billing", assertions: 0 },
        { contract: "loyalty", assertions: 1 },
        { contract: "webhook", assertions: 1 },
      ],
    },
  ])
    assert.throws(() =>
      validateProbeResult(
        { ...result, ...changed },
        revision,
        digest,
        challenge
      )
    )
})

test("runner refuses unmarked database before any database mutation", () => {
  const revision = "a".repeat(40)
  const { probe, cleanup } = makeProbe(revision)
  const writes = []
  assert.throws(
    () =>
      runPopulatedUpgrade(
        {
          databaseUrl: url,
          marker,
          repository: process.cwd(),
          baselineRevision: revision,
          candidateRevision: revision,
          rollbackRevision: revision,
          probes: [probe, probe, probe],
        },
        {
          env: { PATH: process.env.PATH },
          spawn: (command, args, options) => {
            let stdout = ""
            if (command === "git") {
              if (args[0] === "rev-parse") stdout = revision + "\n"
              if (args[0] === "ls-tree")
                stdout = "supabase/migrations/20260101000000_first.sql\n"
              if (args[0] === "show") stdout = "select 1;\n"
            } else {
              writes.push(options.input)
              stdout = ""
            }
            return { status: 0, stdout }
          },
        }
      ),
    /marker missing/
  )
  assert.equal(writes.length, 1)
  assert.match(writes[0], /^select marker/)
  cleanup()
})

function makeProbe(revision = "a".repeat(40)) {
  const root = mkdtempSync(join(tmpdir(), "upgrade-probe-test-"))
  const artifactRoot = join(root, "artifact")
  mkdirSync(artifactRoot)
  for (const [name, contents] of Object.entries({
    runtime: "test-binary",
    "probe.mjs": "// execute real assertions",
    "app.mjs": "// compiled app",
    "pnpm-lock.yaml": "lockfileVersion: 9.0",
  }))
    writeFileSync(join(artifactRoot, name), contents)
  const manifestPath = join(root, "manifest.json")
  const manifest = {
    schema: "nabaperks.upgrade-probe.v1",
    revision,
    databaseAdapter: "upgrade-database-url-only",
    runtime: "runtime",
    entrypoint: "probe.mjs",
    application: "app.mjs",
    lockfile: "pnpm-lock.yaml",
    args: [],
    treeDigest: probeTreeDigest(artifactRoot),
  }
  const bytes = JSON.stringify(manifest)
  writeFileSync(manifestPath, bytes)
  return {
    probe: {
      revision,
      artifactRoot,
      manifestPath,
      manifestDigest: createHash("sha256").update(bytes).digest("hex"),
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

test("probe manifest binds script and complete application dependencies, not merely interpreter", () => {
  const { probe, cleanup } = makeProbe()
  try {
    validateProbeArtifact(probe, probe.revision)
    writeFileSync(join(probe.artifactRoot, "app.mjs"), "// different app")
    assert.throws(
      () => validateProbeArtifact(probe, probe.revision),
      /bytes changed/
    )
  } finally {
    cleanup()
  }
})
test("probe rejects dotenv and interpreter-only legacy config", () => {
  const { probe, cleanup } = makeProbe()
  try {
    writeFileSync(
      join(probe.artifactRoot, ".env.local"),
      "SUPABASE_DB_URL=external"
    )
    assert.throws(() => validateProbeArtifact(probe, probe.revision), /dotenv/)
    assert.throws(
      () =>
        validateProbeArtifact(
          {
            revision: probe.revision,
            executable: "/usr/bin/env",
            sha256: "a".repeat(64),
            args: ["script.mjs"],
          },
          probe.revision
        ),
      /manifest/
    )
  } finally {
    cleanup()
  }
})
test("each migration and ledger version commit together while explicit commits fail closed", () => {
  const migration = {
    name: "20260101000000_first.sql",
    contents: "create table test(id int); do $$ begin perform 1; end $$;",
  }
  const sql = transactionalMigration(migration)
  assert.match(sql, /^begin;/)
  assert.match(sql, /schema_migrations\(version,name,statements\)/)
  assert.match(sql, /content_sha256/)
  assert.match(sql, /commit;\n$/)
  assert.throws(
    () =>
      transactionalMigration({
        ...migration,
        contents: "create table test(id int); commit; select 1;",
      }),
    /transaction control/
  )
  assert.throws(
    () =>
      transactionalMigration({ ...migration, contents: "\\! touch /tmp/no" }),
    /meta commands/
  )
})

test("fixture drift after an app probe fails even when SQL checks exit successfully", () => {
  const { probe, cleanup } = makeProbe()
  let invariantRead = 0,
    probeCalls = 0
  const calls = []
  try {
    assert.throws(
      () =>
        runPopulatedUpgrade(
          {
            databaseUrl: url,
            marker,
            repository: process.cwd(),
            baselineRevision: probe.revision,
            candidateRevision: probe.revision,
            rollbackRevision: probe.revision,
            probes: [probe, probe, probe],
          },
          {
            env: { PATH: process.env.PATH },
            spawn: (command, args, options) => {
              calls.push({ command, args, input: options.input })
              let stdout = ""
              if (command === "git") {
                if (args[0] === "rev-parse") stdout = probe.revision + "\n"
                if (args[0] === "ls-tree")
                  stdout = "supabase/migrations/20260101000000_first.sql\n"
                if (args[0] === "show") stdout = "select 1;\n"
              } else if (command === "psql") {
                const sql = options.input
                if (
                  sql.startsWith("select marker") ||
                  sql.startsWith("update codex_upgrade_guard.target")
                )
                  stdout = marker
                else if (sql.startsWith("select count(*)")) stdout = "0"
                else if (sql.includes("then 'supabase-platform-ready'"))
                  stdout = "supabase-platform-ready"
                else if (sql.startsWith("begin read only;")) {
                  invariantRead++
                  stdout = JSON.stringify({
                    fixtureRows: invariantRead === 3 ? 15 : 16,
                    subscriptions: 3,
                    memberships: 1,
                    stampEvents: 1,
                    rewards: 1,
                    webhooks: 2,
                  })
                }
              } else {
                probeCalls++
                assert.equal(options.cwd, probe.artifactRoot)
                assert.equal(options.env.UPGRADE_DATABASE_URL, url)
                stdout = JSON.stringify({
                  revision: probe.revision,
                  migrationDigest: options.env.UPGRADE_MIGRATION_DIGEST,
                  challenge: options.env.UPGRADE_CHALLENGE,
                  result: "success",
                  checks: ["billing", "loyalty", "webhook"].map((contract) => ({
                    contract,
                    assertions: 1,
                  })),
                })
              }
              return { status: 0, stdout }
            },
          }
        ),
      /invariants changed after application probe/
    )
    assert.equal(probeCalls, 1)
    assert.ok(
      calls.some(
        (call) =>
          call.input?.startsWith("begin;\nselect 1;") &&
          call.input.includes("schema_migrations(version,name,statements)")
      )
    )
  } finally {
    cleanup()
  }
})

test("migration guard refuses ABORT rollback alias and inline psql target escapes", () => {
  for (const contents of [
    "create table test(id int); ABORT; select 1;",
    "select 'COMMIT' \\gexec",
    "select 1; \\connect production",
  ])
    assert.throws(
      () =>
        transactionalMigration({ name: "20260101000000_first.sql", contents }),
      /transaction control|meta commands/
    )
})
