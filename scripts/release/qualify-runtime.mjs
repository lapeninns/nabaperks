import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { sourceIdentity, requiresCompatibility } from "./stage-ledger.mjs"
import { validateCompatibilityEvidence } from "./compatibility.mjs"
import { provisionDisposablePlatform } from "./disposable-platform.mjs"

const hash = (value) => createHash("sha256").update(value).digest("hex")
const scriptRoot = fileURLToPath(new URL("../..", import.meta.url))

export function bindExecution(execution, identity) {
  assert.equal(execution.schema, "nabaperks.populated-upgrade.v1")
  assert.equal(execution.candidateRevision, identity.revision)
  assert.equal(execution.migrationDigest, identity.migrationDigest)
  const evidence = {
    ...execution,
    schema: "nabaperks.release-stage.v1",
    identity,
    stage: "qualified",
    result: "success",
    completedAt: new Date().toISOString(),
    evidenceDigest: hash(JSON.stringify(execution)),
  }
  return validateCompatibilityEvidence(evidence, {
    identity,
    baselineRevision: identity.baselineRevision,
    rollbackRevision: identity.rollbackRevision,
  })
}

// Until per-revision runtime provisioning is supported, refuse runtime
// transitions rather than certifying rollback with the candidate runtime.
export function assertSharedRuntime({
  baselinePin,
  candidatePin,
  runtimeVersion,
}) {
  const normalize = (pin) => pin.trim().replace(/^v/, "")
  const baseline = normalize(baselinePin)
  const candidate = normalize(candidatePin)
  assert.match(
    baseline,
    /^\d+(?:\.\d+){0,2}$/,
    "Baseline Node pin must be numeric"
  )
  assert.equal(
    candidate,
    baseline,
    "Different baseline/candidate Node pins require separate runtime qualification"
  )
  const actual = normalize(runtimeVersion).split(".")
  assert.equal(actual.length, 3, "Actual Node version must be complete")
  assert.ok(
    baseline.split(".").every((part, index) => part === actual[index]),
    "Qualification runtime does not match the shared Node pin"
  )
}

export function qualifyRuntime({
  repository,
  baselineRevision,
  output,
  revision,
  runId,
  attempt,
}) {
  const source = sourceIdentity({
    cwd: repository,
    baselineRevision,
    revision,
    runId,
    attempt,
  })
  assert.equal(resolve(output), output)
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, "identity.json"), JSON.stringify(source.identity))
  if (
    !requiresCompatibility(source.changedPaths, source.packageComparison).length
  )
    return null
  const temporary = realpathSync(
    mkdtempSync(join(tmpdir(), "upgrade-release-"))
  )
  const env = { PATH: process.env.PATH, HOME: temporary, CI: "1" }
  const execute = (command, args, extra = {}) =>
    execFileSync(command, args, {
      cwd: repository,
      env: { ...env, ...extra },
      timeout: 1_800_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })
  const baselineSource = join(temporary, "baseline")
  execute("git", [
    "worktree",
    "add",
    "--detach",
    baselineSource,
    baselineRevision,
  ])
  let platform
  try {
    assertSharedRuntime({
      baselinePin: execute("git", [
        "show",
        `${baselineRevision}:.nvmrc`,
      ]).toString(),
      candidatePin: execute("git", ["show", `${revision}:.nvmrc`]).toString(),
      runtimeVersion: process.version,
    })
    const runtimePath = realpathSync(process.execPath)
    const runtimeDigest = hash(readFileSync(runtimePath))
    const probes = [
      { role: "baseline", source: baselineSource, revision: baselineRevision },
      { role: "candidate", source: repository, revision },
    ].map(({ role, ...pin }) => {
      const configPath = join(temporary, `${role}.json`)
      writeFileSync(
        configPath,
        JSON.stringify({
          ...pin,
          runtimePath,
          runtimeDigest,
          output: join(output, `${role}-probe`),
        })
      )
      return JSON.parse(
        execute(runtimePath, [
          join(scriptRoot, "tests/fixtures/release-upgrade/build-probe.mjs"),
          configPath,
        ]).toString()
      )
    })
    platform = provisionDisposablePlatform()
    const configPath = join(temporary, "execution.json")
    writeFileSync(
      configPath,
      JSON.stringify({
        repository,
        baselineRevision,
        candidateRevision: revision,
        rollbackRevision: baselineRevision,
        marker: platform.marker,
        probes: [...probes, probes[0]],
      })
    )
    const execution = JSON.parse(
      execute(
        runtimePath,
        [join(scriptRoot, "scripts/release/populated-upgrade.mjs"), configPath],
        { UPGRADE_DATABASE_URL: platform.databaseUrl }
      ).toString()
    )
    // Re-read exact candidate source after executing untrusted app dependencies.
    assert.deepEqual(
      sourceIdentity({
        cwd: repository,
        baselineRevision,
        revision,
        runId,
        attempt,
      }),
      source
    )
    const evidence = bindExecution(execution, source.identity)
    writeFileSync(
      join(output, "populated-execution.json"),
      JSON.stringify(execution)
    )
    writeFileSync(join(output, "compatibility.json"), JSON.stringify(evidence))
    return evidence
  } finally {
    try {
      platform?.stop()
    } finally {
      execute("git", ["worktree", "remove", baselineSource])
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(
      process.argv.length,
      4,
      "Usage: qualify-runtime.mjs <baseline SHA> <output directory>"
    )
    qualifyRuntime({
      repository: process.cwd(),
      baselineRevision: process.argv[2],
      output: process.argv[3],
      revision: process.env.EXPECTED_REVISION,
      runId: process.env.RELEASE_RUN_ID,
      attempt: Number(process.env.RELEASE_RUN_ATTEMPT),
    })
  } catch (error) {
    console.error(`Runtime qualification failed: ${error.message}`)
    process.exitCode = 1
  }
}
