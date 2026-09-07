import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import {
  qualifyRelease,
  recordStage,
  requiresCompatibility,
  sourceIdentity,
  verifyLedger,
  verifySourceComparison,
} from "../../scripts/release/stage-ledger.mjs"

const identity = {
  releaseId: "42-1",
  revision: "a".repeat(40),
  baselineRevision: "b".repeat(40),
  rollbackRevision: "b".repeat(40),
  runId: "42",
  attempt: 1,
  sourceDigest: "c".repeat(64),
  migrationDigest: "d".repeat(64),
}
const now = Date.parse("2026-09-07T00:10:00.000Z")
const bytes = (stage, extra = {}) =>
  Buffer.from(JSON.stringify({ stage, result: "success", identity, ...extra }))
const source = {
  identity,
  changedPaths: [".github/workflows/ci.yml", "docs/operations/ci-redesign.md"],
}

test("unchanged qualification is explicitly limited to reviewed CI/docs/test files", () => {
  assert.deepEqual(requiresCompatibility(source.changedPaths), [])
  assert.deepEqual(
    requiresCompatibility([
      "scripts/recovery/monitoring-evidence.mjs",
      "scripts/recovery/restore-evidence.mjs",
      "scripts/release/deployed-baseline.mjs",
      "scripts/release/populated-upgrade.mjs",
      "config/independent-monitoring-contract.json",
      "config/local-ci-image-manifest.json",
      "ops/local-ci/agent/lease.mjs",
      "scripts/ci/browser-parity.mjs",
      "ops/monitoring/independent-monitor.mjs",
      "ops/monitoring/config.example.json",
    ]),
    []
  )
  assert.deepEqual(
    requiresCompatibility(["scripts/recovery/unreviewed-runtime.mjs"]),
    ["scripts/recovery/unreviewed-runtime.mjs"]
  )
  for (const path of [
    "app/page.tsx",
    "package.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "scripts/build.mjs",
    "config/env-contract.json",
    "supabase/migrations/20260101000000_test.sql",
    "public/icon.png",
    "lib/auth/session.ts",
  ]) {
    assert.deepEqual(requiresCompatibility([path]), [path])
    assert.throws(
      () =>
        qualifyRelease({ identity, changedPaths: [path] }, undefined, { now }),
      /full populated/
    )
  }
  const result = qualifyRelease(source, undefined, { now })
  const evidence = JSON.parse(result.evidenceBytes)
  assert.equal(evidence.mode, "unchanged-application-and-schema")
  assert.equal(evidence.compatibility, null)
  assert.throws(
    () =>
      qualifyRelease(
        {
          ...source,
          identity: { ...identity, rollbackRevision: "e".repeat(40) },
        },
        undefined,
        { now }
      ),
    /deployed baseline/
  )
})

test("stage chain verifies external evidence and rejects missing stages, replay and stale predecessors", () => {
  let { ledger, evidenceBytes } = qualifyRelease(source, undefined, { now })
  verifyLedger(ledger, identity, "qualified", evidenceBytes, { now })
  assert.throws(
    () =>
      verifyLedger(ledger, identity, "qualified", Buffer.from("wrong"), {
        now,
      }),
    /external evidence/
  )
  assert.throws(
    () => recordStage("promoted", identity, ledger, bytes("promoted"), { now }),
    /unexpected release stage/
  )
  const qualification = ledger
  for (const [index, stage] of [
    "database-applied",
    "candidate-ready",
    "promoted",
    "verified",
  ].entries()) {
    evidenceBytes = bytes(stage)
    ledger = recordStage(stage, identity, ledger, evidenceBytes, {
      now: now + (index + 1) * 1000,
    })
    verifyLedger(ledger, identity, stage, evidenceBytes, { now: now + 5000 })
  }
  assert.throws(() =>
    recordStage("verified", identity, ledger, bytes("verified"), {
      now: now + 6000,
    })
  )
  assert.throws(
    () =>
      verifyLedger(ledger, identity, "verified", evidenceBytes, {
        now: now + 3_601_000,
      }),
    /stale/
  )
  assert.throws(
    () =>
      recordStage(
        "database-applied",
        identity,
        qualification,
        bytes("database-applied"),
        { now: now - 1 }
      ),
    /future/
  )
  assert.throws(
    () =>
      recordStage(
        "database-applied",
        identity,
        qualification,
        bytes("database-applied", { result: "failure" }),
        { now }
      ),
    /did not succeed/
  )
  assert.throws(
    () =>
      verifyLedger(
        ledger,
        { ...identity, attempt: 2 },
        "verified",
        evidenceBytes,
        { now: now + 5000 }
      ),
    /identity mismatch/
  )
})

test("changed runtime requires full execution matrix bound to baseline, rollback, schema and attempt", () => {
  const compatibility = {
    schema: "nabaperks.release-stage.v1",
    identity,
    stage: "qualified",
    result: "success",
    completedAt: new Date(now).toISOString(),
    evidenceDigest: "e".repeat(64),
    baselineRevision: identity.baselineRevision,
    rollbackRevision: identity.rollbackRevision,
    fixtureDigest: "f".repeat(64),
    fixtureRows: 15,
    targetKind: "disposable",
    checks: [
      ["populated-upgrade", identity.revision],
      ["baseline-app-upgraded-schema", identity.baselineRevision],
      ["candidate-app-upgraded-schema", identity.revision],
      ["rollback-app-upgraded-schema", identity.rollbackRevision],
    ].map(([name, revision]) => ({
      name,
      revision,
      result: "success",
      migrationDigest: identity.migrationDigest,
      evidenceDigest: "e".repeat(64),
    })),
  }
  const changed = { identity, changedPaths: ["app/page.tsx"] }
  const result = qualifyRelease(changed, compatibility, { now })
  assert.equal(JSON.parse(result.evidenceBytes).mode, "executed-compatibility")
  assert.throws(() =>
    qualifyRelease(
      changed,
      { ...compatibility, checks: compatibility.checks.slice(1) },
      { now }
    )
  )
  assert.throws(() =>
    qualifyRelease(changed, { ...compatibility, fixtureRows: 0 }, { now })
  )
  assert.throws(
    () => verifySourceComparison(result.ledger, source),
    /Git tree comparison/
  )
})

test("Git-backed CLI matches the attested archive, compares all inputs and refuses overwrite or dirty source", () => {
  const root = mkdtempSync(join(tmpdir(), "release-ledger-"))
  const cwd = join(root, "repo")
  mkdirSync(cwd)
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  const put = (path, contents) => {
    mkdirSync(join(cwd, path, ".."), { recursive: true })
    writeFileSync(join(cwd, path), contents)
  }
  try {
    git("init")
    git("config", "user.email", "fixture@example.invalid")
    git("config", "user.name", "Release Fixture")
    put("app/page.tsx", "baseline")
    put("supabase/migrations/20260101000000_initial.sql", "select 1;")
    git("add", "app/page.tsx", "supabase/migrations/20260101000000_initial.sql")
    git("commit", "-m", "baseline")
    const baselineRevision = git("rev-parse", "HEAD")
    put("docs/release.md", "CI documentation")
    git("add", "docs/release.md")
    git("commit", "-m", "CI documentation")
    const revision = git("rev-parse", "HEAD")
    const config = { cwd, revision, baselineRevision, runId: "42", attempt: 1 }
    const actual = sourceIdentity(config)
    assert.deepEqual(actual.changedPaths, ["docs/release.md"])
    const archive = execFileSync("gzip", ["-n"], {
      input: execFileSync(
        "git",
        ["archive", "--format=tar", "--prefix=nabaperks/", revision],
        { cwd }
      ),
    })
    assert.equal(
      actual.identity.sourceDigest,
      createHash("sha256").update(archive).digest("hex")
    )
    const script = resolve("scripts/release/stage-ledger.mjs")
    const env = {
      ...process.env,
      EXPECTED_REVISION: revision,
      RELEASE_RUN_ID: "42",
      RELEASE_RUN_ATTEMPT: "1",
    }
    const output = join(root, "qualified.json")
    const evidence = join(root, "qualified-evidence.json")
    const args = [
      script,
      "qualify",
      "--baseline",
      baselineRevision,
      "--output",
      output,
      "--evidence",
      evidence,
    ]
    assert.equal(spawnSync(process.execPath, args, { cwd, env }).status, 0)
    assert.equal(
      spawnSync(process.execPath, args, { cwd, env }).status,
      1,
      "same-stage output must not overwrite"
    )
    const verify = [
      script,
      "verify",
      "--baseline",
      baselineRevision,
      "--stage",
      "qualified",
      "--manifest",
      output,
      "--evidence",
      evidence,
    ]
    assert.equal(spawnSync(process.execPath, verify, { cwd, env }).status, 0)
    writeFileSync(evidence, "tampered")
    assert.equal(spawnSync(process.execPath, verify, { cwd, env }).status, 1)
    assert.equal(
      JSON.parse(readFileSync(output)).manifest.identity.baselineRevision,
      baselineRevision
    )
    put("app/page.tsx", "changed runtime")
    assert.throws(() => sourceIdentity(config), /clean/)
    git("add", "app/page.tsx")
    git("commit", "-m", "runtime changed")
    const changed = sourceIdentity({
      ...config,
      revision: git("rev-parse", "HEAD"),
    })
    assert.throws(() => qualifyRelease(changed), /full populated/)
    assert.throws(
      () =>
        sourceIdentity({
          ...config,
          revision: git("rev-parse", "HEAD"),
          baselineRevision: baselineRevision.slice(0, 12),
        }),
      /full SHAs/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
