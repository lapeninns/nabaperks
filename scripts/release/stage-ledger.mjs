import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import {
  migrationDigest,
  stageManifestDigest,
  validateStageManifest,
  validateStageTransition,
} from "./manifest.mjs"
import { validateCompatibilityEvidence } from "./compatibility.mjs"

const STAGES = [
  "qualified",
  "database-applied",
  "candidate-ready",
  "promoted",
  "verified",
]
const SHA = /^[a-f0-9]{40}$/
const CI_FILES = new Set([
  "AGENTS.md",
  "DESIGN.md",
  "README.md",
  ".github/CODEOWNERS",
  "config/ci-workloads.json",
  "config/github-governance-contract.json",
  "config/local-ci-contract.json",
  "config/local-ci-image-manifest.json",
  "config/independent-monitoring-contract.json",
  "scripts/check-local-ci-proof.mjs",
  "scripts/check-restored-backup.mjs",
  "scripts/notify-production-alert.mjs",
  "scripts/watchdog-incidents.mjs",
  "scripts/check-production-slo.mjs",
  "scripts/release/candidate.mjs",
  "scripts/release/manifest.mjs",
  "scripts/release/compatibility.mjs",
  "scripts/release/read-candidate-artifact.mjs",
  "scripts/release/stage-ledger.mjs",
  "scripts/release/populated-upgrade.mjs",
  "scripts/release/deployed-baseline.mjs",
  "scripts/recovery/monitoring-evidence.mjs",
  "scripts/recovery/restore-evidence.mjs",
  "ops/monitoring/independent-monitor.mjs",
  "ops/monitoring/config.example.json",
])
const CI_PREFIXES = [
  "docs/",
  "tests/",
  ".github/workflows/",
  ".github/actions/",
  "ops/local-ci/",
  "scripts/ci/",
]

const digest = (contents) => createHash("sha256").update(contents).digest("hex")
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`)

export function requiresCompatibility(changedPaths) {
  return changedPaths.filter(
    (path) =>
      !CI_FILES.has(path) &&
      !CI_PREFIXES.some((prefix) => path.startsWith(prefix))
  )
}

export function sourceIdentity({
  cwd = process.cwd(),
  revision,
  baselineRevision,
  rollbackRevision = baselineRevision,
  runId,
  attempt,
}) {
  for (const value of [revision, baselineRevision, rollbackRevision])
    assert.match(
      value ?? "",
      SHA,
      "candidate, deployed baseline and rollback require full SHAs"
    )
  assert.match(runId ?? "", /^[1-9]\d*$/, "parent release run ID required")
  assert.ok(
    Number.isSafeInteger(attempt) && attempt > 0,
    "parent release attempt required"
  )
  const git = (args, encoding = "utf8") =>
    execFileSync("git", args, {
      cwd,
      encoding,
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })
  assert.equal(
    git(["rev-parse", "HEAD"]).trim(),
    revision,
    "checkout is not the candidate"
  )
  assert.equal(
    git(["status", "--porcelain", "--untracked-files=all"]),
    "",
    "release checkout must be clean"
  )
  for (const commit of [baselineRevision, rollbackRevision])
    assert.equal(
      git(["rev-parse", `${commit}^{commit}`]).trim(),
      commit,
      "baseline or rollback commit unavailable"
    )
  const tar = git(
    ["archive", "--format=tar", "--prefix=nabaperks/", revision],
    null
  )
  const archive = execFileSync("gzip", ["-n"], {
    input: tar,
    maxBuffer: 128 * 1024 * 1024,
  })
  const names = git([
    "ls-tree",
    "-r",
    "--name-only",
    "-z",
    revision,
    "--",
    "supabase/migrations/",
  ])
    .split("\0")
    .filter(Boolean)
  const migrations = names.map((path) => ({
    name: path.slice("supabase/migrations/".length),
    contents: git(["show", `${revision}:${path}`], null),
  }))
  const changedPaths = git([
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    baselineRevision,
    revision,
    "--",
  ])
    .split("\0")
    .filter(Boolean)
  return {
    identity: {
      releaseId: `${runId}-${attempt}`,
      revision,
      baselineRevision,
      rollbackRevision,
      runId,
      attempt,
      sourceDigest: digest(archive),
      migrationDigest: migrationDigest(migrations),
    },
    changedPaths,
  }
}

export function qualifyRelease(
  source,
  compatibility,
  { now = Date.now(), maxAgeMs = 3_600_000 } = {}
) {
  const { identity, changedPaths } = source
  const runtimeChanges = requiresCompatibility(changedPaths)
  let mode = "unchanged-application-and-schema"
  if (runtimeChanges.length > 0) {
    assert.ok(
      compatibility,
      "application or schema changed; full populated upgrade and rollback compatibility proof required"
    )
    validateCompatibilityEvidence(
      compatibility,
      {
        identity,
        baselineRevision: identity.baselineRevision,
        rollbackRevision: identity.rollbackRevision,
      },
      { now, maxAgeMs }
    )
    mode = "executed-compatibility"
  } else {
    assert.equal(
      identity.rollbackRevision,
      identity.baselineRevision,
      "unchanged qualification rollback must be the deployed baseline"
    )
  }
  const evidence = {
    stage: "qualified",
    result: "success",
    identity,
    mode,
    changedPaths,
    compatibility: mode === "executed-compatibility" ? compatibility : null,
  }
  const bytes = jsonBytes(evidence)
  return {
    ledger: makeLedger("qualified", identity, bytes, null, now),
    evidenceBytes: bytes,
  }
}

function makeLedger(stage, identity, evidenceBytes, previous, now) {
  const manifest = {
    schema: "nabaperks.release-stage.v1",
    identity,
    stage,
    result: "success",
    completedAt: new Date(now).toISOString(),
    evidenceDigest: digest(evidenceBytes),
    ...(previous
      ? { previousDigest: stageManifestDigest(previous.manifest) }
      : {}),
  }
  return {
    schema: "nabaperks.release-ledger.v1",
    manifest,
    evidence: evidenceBytes.toString("base64"),
    previous,
  }
}

export function recordStage(
  stage,
  identity,
  previous,
  evidenceBytes,
  clock = {}
) {
  assert.ok(
    STAGES.includes(stage) && stage !== "qualified",
    "record requires a post-qualification stage"
  )
  verifyLedger(previous, identity, previous.manifest.stage, null, clock)
  const next = makeLedger(
    stage,
    identity,
    evidenceBytes,
    previous,
    clock.now ?? Date.now()
  )
  verifyLedger(next, identity, stage, evidenceBytes, clock)
  return next
}

export function verifyLedger(
  ledger,
  identity,
  expectedStage,
  externalEvidence,
  clock = {},
  depth = 0
) {
  assert.ok(
    depth < STAGES.length && ledger?.schema === "nabaperks.release-ledger.v1",
    "invalid or excessively nested stage ledger"
  )
  assert.equal(
    ledger.manifest?.stage,
    expectedStage,
    "unexpected release stage"
  )
  validateStageManifest(ledger.manifest, identity, clock)
  assert.ok(
    typeof ledger.evidence === "string" && ledger.evidence.length <= 131_072,
    "invalid stage evidence size"
  )
  const bytes = Buffer.from(ledger.evidence, "base64")
  assert.equal(
    bytes.toString("base64"),
    ledger.evidence,
    "invalid evidence encoding"
  )
  assert.equal(
    digest(bytes),
    ledger.manifest.evidenceDigest,
    "stage evidence content digest mismatch"
  )
  if (externalEvidence !== null) {
    assert.ok(
      Buffer.isBuffer(externalEvidence),
      "external evidence bytes required"
    )
    assert.equal(
      digest(externalEvidence),
      ledger.manifest.evidenceDigest,
      "external evidence content digest mismatch"
    )
  }
  const evidence = JSON.parse(bytes.toString("utf8"))
  assert.equal(evidence.stage, expectedStage, "evidence stage mismatch")
  assert.equal(evidence.result, "success", "execution evidence did not succeed")
  assert.deepEqual(
    evidence.identity,
    identity,
    "execution evidence identity mismatch"
  )
  const index = STAGES.indexOf(expectedStage)
  if (index === 0) {
    assert.equal(ledger.previous, null, "qualification must start the chain")
    assert.ok(
      Array.isArray(evidence.changedPaths),
      "qualification source comparison required"
    )
    if (evidence.mode === "unchanged-application-and-schema") {
      assert.deepEqual(
        requiresCompatibility(evidence.changedPaths),
        [],
        "unchanged qualification includes runtime changes"
      )
      assert.equal(
        identity.rollbackRevision,
        identity.baselineRevision,
        "rollback is not the deployed baseline"
      )
      assert.equal(
        evidence.compatibility,
        null,
        "unchanged source must not claim executed compatibility"
      )
    } else {
      assert.equal(
        evidence.mode,
        "executed-compatibility",
        "unknown qualification mode"
      )
      validateCompatibilityEvidence(
        evidence.compatibility,
        {
          identity,
          baselineRevision: identity.baselineRevision,
          rollbackRevision: identity.rollbackRevision,
        },
        clock
      )
    }
  } else {
    assert.ok(ledger.previous, "previous stage required")
    verifyLedger(
      ledger.previous,
      identity,
      STAGES[index - 1],
      null,
      clock,
      depth + 1
    )
    validateStageTransition(
      ledger.previous.manifest,
      ledger.manifest,
      identity,
      clock
    )
  }
  return ledger
}

export function verifySourceComparison(ledger, source) {
  let first = ledger
  for (let count = 0; first?.previous && count < STAGES.length; count++)
    first = first.previous
  assert.equal(
    first?.manifest?.stage,
    "qualified",
    "qualification source comparison missing"
  )
  const evidence = JSON.parse(
    Buffer.from(first.evidence, "base64").toString("utf8")
  )
  assert.deepEqual(
    evidence.changedPaths,
    source.changedPaths,
    "qualification does not match the full Git tree comparison"
  )
}

function parseArgs(args) {
  const [command, ...rest] = args
  assert.ok(
    ["qualify", "record", "verify", "identity"].includes(command),
    "invalid stage-ledger command"
  )
  const options = {}
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]
    assert.ok(
      [
        "--baseline",
        "--rollback",
        "--output",
        "--evidence",
        "--compatibility",
        "--previous",
        "--manifest",
        "--stage",
      ].includes(key),
      "unknown CLI option"
    )
    assert.ok(
      rest[index + 1] && !Object.hasOwn(options, key),
      "missing or duplicate CLI option"
    )
    options[key] = rest[index + 1]
  }
  return { command, options }
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2))
  const source = sourceIdentity({
    revision: process.env.EXPECTED_REVISION,
    baselineRevision: options["--baseline"],
    rollbackRevision: options["--rollback"] ?? options["--baseline"],
    runId: process.env.RELEASE_RUN_ID,
    attempt: Number(process.env.RELEASE_RUN_ATTEMPT),
  })
  if (command === "identity") {
    console.log(JSON.stringify(source.identity))
    return
  }
  const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
  if (command === "qualify") {
    assert.ok(
      options["--output"] && options["--evidence"],
      "qualification output and evidence paths required"
    )
    const result = qualifyRelease(
      source,
      options["--compatibility"]
        ? readJson(options["--compatibility"])
        : undefined
    )
    writeFileSync(options["--evidence"], result.evidenceBytes, {
      flag: "wx",
      mode: 0o600,
    })
    writeFileSync(options["--output"], jsonBytes(result.ledger), {
      flag: "wx",
      mode: 0o600,
    })
  } else if (command === "record") {
    const previous = readJson(options["--previous"])
    verifySourceComparison(previous, source)
    const ledger = recordStage(
      options["--stage"],
      source.identity,
      previous,
      readFileSync(options["--evidence"])
    )
    writeFileSync(options["--output"], jsonBytes(ledger), {
      flag: "wx",
      mode: 0o600,
    })
  } else {
    const ledger = readJson(options["--manifest"])
    verifySourceComparison(ledger, source)
    verifyLedger(
      ledger,
      source.identity,
      options["--stage"],
      readFileSync(options["--evidence"])
    )
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    main()
  } catch {
    console.error(
      "Release stage ledger verification failed; advancing the release is forbidden."
    )
    process.exitCode = 1
  }
}
