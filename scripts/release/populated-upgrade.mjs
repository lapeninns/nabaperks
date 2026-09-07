import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  lstatSync,
  existsSync,
} from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve, join, dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { migrationDigest } from "./manifest.mjs"

const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const SHA = /^[a-f0-9]{40}$/
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

export function validateDisposableTarget(
  databaseUrl,
  marker,
  env = process.env
) {
  const url = new URL(databaseUrl)
  assert.ok(
    ["postgres:", "postgresql:"].includes(url.protocol),
    "Postgres URL required"
  )
  assert.ok(
    ["127.0.0.1", "[::1]"].includes(url.hostname),
    "Literal loopback database required"
  )
  assert.match(
    url.pathname,
    /^\/codex_upgrade_[a-z0-9_]+$/,
    "Named disposable database required"
  )
  assert.equal(url.search + url.hash, "", "Connection overrides forbidden")
  assert.match(marker ?? "", UUID, "Disposable provisioner marker required")
  for (const [key, value] of Object.entries(env)) {
    if (
      value &&
      /SUPABASE|STRIPE|TWILIO|RESEND|VERCEL|PGHOST|PGSERVICE|PGPASSFILE|PGOPTIONS|DATABASE_URL|DB_URL/.test(
        key
      )
    ) {
      assert.equal(
        key,
        "UPGRADE_DATABASE_URL",
        "Provider or ambient database credentials must be absent"
      )
      assert.equal(value, databaseUrl, "Database URL mismatch")
    }
  }
  return url
}

export function migrationDelta(baseline, candidate) {
  assert.ok(
    baseline.length > 0 && candidate.length >= baseline.length,
    "Non-empty baseline and candidate migrations required"
  )
  baseline.forEach((entry, index) => {
    assert.equal(candidate[index]?.name, entry.name, "Migration prefix changed")
    assert.equal(
      sha256(candidate[index].contents),
      sha256(entry.contents),
      "Baseline migration bytes changed"
    )
  })
  return candidate.slice(baseline.length)
}

// Digest the complete self-contained build, dependencies and runtime. Symlinks
// and dotenv files are forbidden so validation cannot accidentally follow an
// external dependency checkout or load repository/provider credentials.
function readProbeFile(path) {
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  )
  try {
    const before = fstatSync(descriptor, { bigint: true })
    assert.ok(before.isFile(), "Probe artifact special files forbidden")
    const contents = readFileSync(descriptor)
    const after = fstatSync(descriptor, { bigint: true })
    assert.ok(
      before.size === after.size &&
        before.mtimeNs === after.mtimeNs &&
        before.ctimeNs === after.ctimeNs,
      "Probe artifact changed during descriptor read"
    )
    return { contents, mode: Number(before.mode & 0o777n) }
  } finally {
    closeSync(descriptor)
  }
}

export function probeTreeDigest(root) {
  assert.equal(resolve(root), root, "Absolute probe artifact root required")
  assert.equal(
    realpathSync(root),
    root,
    "Probe artifact ancestors must not contain symlinks"
  )
  const records = []
  function walk(directory, prefix = "") {
    const descriptor = openSync(
      directory,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY
    )
    try {
      const before = fstatSync(descriptor, { bigint: true })
      assert.ok(before.isDirectory(), "Probe artifact directory required")
      assert.equal(
        realpathSync(directory),
        directory,
        "Probe artifact directory alias forbidden"
      )
      for (const name of readdirSync(directory).sort()) {
        assert.ok(
          !/^\.env(?:\.|$)/.test(name),
          "Probe artifact must not contain dotenv files"
        )
        const path = join(directory, name),
          relative = prefix + name
        const stat = lstatSync(path)
        assert.ok(!stat.isSymbolicLink(), "Probe artifact symlinks forbidden")
        if (stat.isDirectory()) walk(path, relative + "/")
        else {
          assert.ok(stat.isFile(), "Probe artifact special files forbidden")
          const file = readProbeFile(path)
          records.push([relative, file.mode, sha256(file.contents)])
        }
      }
      const after = fstatSync(descriptor, { bigint: true })
      const current = lstatSync(directory, { bigint: true })
      assert.equal(
        realpathSync(directory),
        directory,
        "Probe artifact directory changed during traversal"
      )
      assert.ok(
        current.isDirectory() &&
          current.dev === before.dev &&
          current.ino === before.ino &&
          before.mtimeNs === after.mtimeNs &&
          before.ctimeNs === after.ctimeNs,
        "Probe artifact directory changed during traversal"
      )
    } finally {
      closeSync(descriptor)
    }
  }
  assert.ok(
    !lstatSync(root).isSymbolicLink(),
    "Probe artifact root symlink forbidden"
  )
  walk(root)
  assert.ok(records.length > 0, "Probe artifact must be populated")
  return sha256(JSON.stringify(records))
}

export function validateProbeArtifact(probe, revision) {
  assert.equal(probe.revision, revision, "Probe order/revision mismatch")
  assert.match(
    probe.manifestDigest ?? "",
    /^[a-f0-9]{64}$/,
    "Probe artifact manifest digest required"
  )
  const manifestBytes = readProbeFile(probe.manifestPath).contents
  assert.equal(
    sha256(manifestBytes),
    probe.manifestDigest,
    "Probe artifact manifest bytes changed"
  )
  const manifest = JSON.parse(manifestBytes)
  assert.equal(manifest.schema, "nabaperks.upgrade-probe.v1")
  assert.equal(manifest.revision, revision, "Probe build revision mismatch")
  assert.equal(
    manifest.databaseAdapter,
    "upgrade-database-url-only",
    "Explicit disposable database adapter required"
  )
  for (const key of ["runtime", "entrypoint", "application", "lockfile"]) {
    assert.match(
      manifest[key] ?? "",
      /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/,
      "Relative artifact paths required"
    )
    assert.ok(
      !manifest[key].split("/").some((part) => part === ".." || part === "."),
      "Artifact path traversal forbidden"
    )
    assert.ok(
      existsSync(join(probe.artifactRoot, manifest[key])),
      `Missing probe ${key}`
    )
  }
  const runtime = readProbeFile(
    join(probe.artifactRoot, manifest.runtime)
  ).contents
  readProbeFile(join(probe.artifactRoot, manifest.entrypoint))
  assert.ok(
    !runtime.subarray(0, 2).equals(Buffer.from("#!")),
    "Runtime must be a bundled binary, not an interpreter wrapper"
  )
  assert.ok(
    Array.isArray(manifest.args) &&
      manifest.args.every(
        (arg) =>
          typeof arg === "string" &&
          !arg.startsWith("/") &&
          !arg.includes("..") &&
          !/\b(?:https?|postgres(?:ql)?):/.test(arg)
      ),
    "External probe argument paths or endpoints forbidden"
  )
  assert.equal(
    probeTreeDigest(probe.artifactRoot),
    manifest.treeDigest,
    "Probe build, script, dependency or runtime bytes changed"
  )
  // Libraries that search ancestors for dotenv must not discover one either.
  let ancestor = resolve(probe.artifactRoot)
  while (true) {
    assert.ok(
      !readdirSync(ancestor).some((name) => /^\.env(?:\.|$)/.test(name)),
      "Probe artifact ancestry contains dotenv files"
    )
    if (dirname(ancestor) === ancestor) break
    ancestor = dirname(ancestor)
  }
  return manifest
}

// Only transaction-control statements at top level are rejected. PL/pgSQL
// bodies, comments and quoted literals are masked before statement splitting.
export function transactionalMigration(migration) {
  assert.match(migration.name, /^\d{14}_[a-z0-9_-]+\.sql$/)
  const sql = migration.contents
  assert.ok(!/^\s*\\/m.test(sql), "psql meta commands forbidden in migrations")
  const masked = sql.replace(
    /\/\*[\s\S]*?\*\/|--[^\n]*|\$([a-zA-Z_][a-zA-Z_0-9]*|)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|"(?:""|[^"])*"/g,
    " "
  )
  assert.ok(
    !masked.includes("\\"),
    "psql meta commands forbidden in migrations"
  )
  for (const statement of masked.split(";")) {
    assert.ok(
      !/^\s*(?:begin|start\s+transaction|commit|rollback|abort|end|prepare\s+transaction)\b/i.test(
        statement
      ),
      "Migration transaction control requires separate reviewed execution"
    )
  }
  const version = migration.name.slice(0, 14),
    name = migration.name.slice(15, -4)
  const digest = sha256(migration.contents)
  return `begin;\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[]::text[]);\ninsert into codex_upgrade_guard.migrations(version,content_sha256) values ('${version}','${digest}');\ncommit;\n`
}

export function validateProbeResult(result, revision, digest, challenge) {
  assert.equal(
    result?.revision,
    revision,
    "Probe application revision mismatch"
  )
  assert.equal(
    result?.migrationDigest,
    digest,
    "Probe migration digest mismatch"
  )
  assert.equal(
    result?.challenge,
    challenge,
    "Probe execution challenge mismatch"
  )
  assert.equal(result?.result, "success", "Application probe failed")
  assert.deepEqual(
    result.checks?.map((check) => check.contract).sort(),
    ["billing", "loyalty", "webhook"],
    "All real application contract probes required"
  )
  for (const check of result.checks)
    assert.ok(
      Number.isSafeInteger(check.assertions) && check.assertions > 0,
      "Executed assertions required"
    )
  return result
}

export function runPopulatedUpgrade(
  options,
  { spawn = spawnSync, env = process.env } = {}
) {
  validateDisposableTarget(options.databaseUrl, options.marker, env)
  for (const key of [
    "baselineRevision",
    "candidateRevision",
    "rollbackRevision",
  ])
    assert.match(options[key] ?? "", SHA, `${key} must be exact SHA`)
  assert.ok(
    Array.isArray(options.probes) && options.probes.length === 3,
    "Baseline, candidate and rollback app executables required"
  )
  const cleanEnv = {
    PATH: env.PATH,
    LANG: "C.UTF-8",
    PGDATABASE: options.databaseUrl,
    PGCONNECT_TIMEOUT: "5",
  }
  function execute(
    command,
    args,
    input,
    extraEnv = {},
    cwd = options.repository
  ) {
    const result = spawn(command, args, {
      cwd,
      env: { ...cleanEnv, ...extraEnv },
      input,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 16 * 1024 * 1024,
    })
    assert.ok(
      !result.error && !result.signal && result.status === 0,
      `${command} execution failed; no compatibility proof produced`
    )
    return result.stdout
  }
  const git = (...args) => execute("git", args).trim()
  const psql = (input) =>
    execute("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], input).trim()
  function migrations(revision) {
    assert.equal(
      git("rev-parse", `${revision}^{commit}`),
      revision,
      "Revision did not resolve exactly"
    )
    return git(
      "ls-tree",
      "-r",
      "--name-only",
      revision,
      "--",
      "supabase/migrations"
    )
      .split("\n")
      .filter((path) => path.endsWith(".sql"))
      .sort()
      .map((path) => ({
        name: path.split("/").at(-1),
        contents: execute("git", ["show", `${revision}:${path}`]),
      }))
  }
  const baseline = migrations(options.baselineRevision)
  const candidate = migrations(options.candidateRevision)
  const delta = migrationDelta(baseline, candidate)
  const digest = migrationDigest(candidate)
  // Validate all executable pins before the first database write.
  const revisions = [
    options.baselineRevision,
    options.candidateRevision,
    options.rollbackRevision,
  ]
  const artifacts = options.probes.map((probe, index) => {
    assert.equal(
      git("rev-parse", `${revisions[index]}^{commit}`),
      revisions[index]
    )
    return validateProbeArtifact(probe, revisions[index])
  })
  // Inspect every migration before any write, including candidate additions.
  const transactions = new Map(
    candidate.map((migration) => [
      migration.name,
      transactionalMigration(migration),
    ])
  )
  // This marker is provisioned outside this harness; it cannot self-authorise
  // an existing application database. A consumed marker refuses another run.
  assert.equal(
    psql(
      `select marker::text from codex_upgrade_guard.target where marker='${options.marker}'::uuid and consumed=false;`
    ),
    options.marker,
    "Disposable target marker missing or consumed"
  )
  assert.equal(
    psql(
      "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');"
    ),
    "0",
    "Target already contains application tables"
  )
  assert.equal(
    psql(
      "select case when current_setting('server_version_num')::int between 170000 and 179999 and to_regclass('auth.sessions') is not null and to_regclass('auth.mfa_factors') is not null and to_regclass('auth.mfa_amr_claims') is not null and to_regclass('auth.identities') is not null and to_regprocedure('auth.uid()') is not null and exists(select 1 from pg_roles where rolname='service_role') and exists(select 1 from pg_roles where rolname='authenticated') and exists(select 1 from pg_roles where rolname='anon') then 'supabase-platform-ready' else 'unsupported-platform' end;"
    ),
    "supabase-platform-ready",
    "Full Supabase platform bootstrap required"
  )
  assert.equal(
    psql("select count(*) from auth.users;"),
    "0",
    "Target contains auth users"
  )
  assert.equal(
    psql(
      `update codex_upgrade_guard.target set consumed=true where marker='${options.marker}'::uuid and consumed=false returning marker::text;`
    ),
    options.marker,
    "Disposable target already claimed"
  )
  const fixture = readFileSync(
    new URL(
      "../../tests/fixtures/release-upgrade/populate.sql",
      import.meta.url
    ),
    "utf8"
  )
  const invariants = readFileSync(
    new URL(
      "../../tests/fixtures/release-upgrade/invariants.sql",
      import.meta.url
    ),
    "utf8"
  )
  psql(
    "begin; create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text); create table codex_upgrade_guard.migrations(version text primary key, content_sha256 text not null); commit;"
  )
  assert.equal(
    psql("select count(*) from supabase_migrations.schema_migrations;"),
    "0",
    "Target migration ledger must start empty"
  )
  for (const migration of baseline) psql(transactions.get(migration.name))
  psql(fixture)
  const before = JSON.parse(psql(invariants))
  assert.equal(before.fixtureRows, 16, "Synthetic fixture row count mismatch")
  for (const migration of delta) psql(transactions.get(migration.name))
  const after = JSON.parse(psql(invariants))
  assert.deepEqual(
    after,
    before,
    "Populated invariants changed during migration"
  )
  const checks = [
    {
      name: "populated-upgrade",
      revision: options.candidateRevision,
      migrationDigest: digest,
      result: "success",
      evidenceDigest: sha256(JSON.stringify({ before, after })),
    },
  ]
  for (const [index, probe] of options.probes.entries()) {
    const artifact = validateProbeArtifact(probe, revisions[index])
    assert.deepEqual(
      artifact,
      artifacts[index],
      "Probe artifact changed after admission"
    )
    const challenge = sha256(`${options.marker}:${index}:${digest}`)
    const result = validateProbeResult(
      JSON.parse(
        execute(
          join(probe.artifactRoot, artifact.runtime),
          [artifact.entrypoint, ...artifact.args],
          undefined,
          {
            UPGRADE_DATABASE_URL: options.databaseUrl,
            UPGRADE_APP_REVISION: revisions[index],
            UPGRADE_MIGRATION_DIGEST: digest,
            UPGRADE_CHALLENGE: challenge,
            UPGRADE_TARGET_MARKER: options.marker,
          },
          probe.artifactRoot
        )
      ),
      revisions[index],
      digest,
      challenge
    )
    assert.deepEqual(
      JSON.parse(psql(invariants)),
      before,
      "Populated invariants changed after application probe"
    )
    validateProbeArtifact(probe, revisions[index])
    checks.push({
      name: [
        "baseline-app-upgraded-schema",
        "candidate-app-upgraded-schema",
        "rollback-app-upgraded-schema",
      ][index],
      revision: revisions[index],
      migrationDigest: digest,
      result: "success",
      evidenceDigest: sha256(JSON.stringify(result)),
      probeArtifactDigest: artifact.treeDigest,
      probeManifestDigest: probe.manifestDigest,
    })
  }
  return {
    schema: "nabaperks.populated-upgrade.v1",
    targetKind: "disposable",
    baselineRevision: options.baselineRevision,
    candidateRevision: options.candidateRevision,
    rollbackRevision: options.rollbackRevision,
    baselineMigrationDigest: migrationDigest(baseline),
    migrationDigest: digest,
    fixtureDigest: sha256(fixture + invariants),
    fixtureRows: before.fixtureRows,
    appliedMigrationCount: delta.length,
    checks,
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(
      process.argv.length,
      3,
      "Usage: node scripts/release/populated-upgrade.mjs <configuration.json>"
    )
    const options = JSON.parse(readFileSync(process.argv[2], "utf8"))
    options.databaseUrl = process.env.UPGRADE_DATABASE_URL
    console.log(JSON.stringify(runPopulatedUpgrade(options)))
  } catch {
    console.error(
      "Disposable populated upgrade proof failed; no release qualification produced."
    )
    process.exitCode = 1
  }
}
