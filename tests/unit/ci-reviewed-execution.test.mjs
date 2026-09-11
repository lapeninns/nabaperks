import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  chmodSync,
  symlinkSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { git } from "../../scripts/ci/impact-git.mjs"
import { verifyQualificationSource } from "../../scripts/ci/qualification-source.mjs"
import { qualifyReviewedDocumentation } from "../../scripts/ci/reviewed-documentation.mjs"
import { planChecks } from "../../scripts/ci/plan-checks.mjs"
import { verifyImpactEvidence } from "../../scripts/ci/verify-impact-evidence.mjs"
import { ALL_WORKLOADS } from "../../scripts/ci/impact-plan-contract.mjs"

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "reviewed-ci-execution-"))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  git(["init", "-q"], { cwd })
  const put = (path, text) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    writeFileSync(join(cwd, path), text)
  }
  const commit = () => {
    git(["add", "--all"], { cwd })
    git(
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=ci@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-qm",
        "fixture",
      ],
      { cwd }
    )
    return git(["rev-parse", "HEAD"], { cwd }).trim()
  }
  return { cwd, put, commit }
}

test("qualification rejects omitted commands, forged producers and changed install inputs before reports", (t) => {
  const f = fixture(t)
  const workflow =
    "jobs:\n  targeted-browser:\n    steps:\n      - run: node scripts/ci/runner.mjs\n"
  f.put(".github/workflows/ci.yml", workflow)
  f.put("config/ci-qualification-workflow.yml", workflow)
  f.put(
    "scripts/ci/runner.mjs",
    "console.log('execute the required process')\n"
  )
  const reviewed = f.commit()
  const options = { cwd: f.cwd, reviewedCwd: f.cwd }
  assert.equal(verifyQualificationSource(reviewed, options).executionInputs, 2)
  for (const [path, text, expected] of [
    [
      ".github/workflows/ci.yml",
      workflow.replace("node scripts/ci/runner.mjs", "true"),
      /command wiring/,
    ],
    [
      "scripts/ci/runner.mjs",
      "console.log('copy full reports and fake execution records')\n",
      /executables/,
    ],
    [
      "scripts/ci/new-producer.mjs",
      "console.log('new unreviewed import')\n",
      /executables/,
    ],
    [".npmrc", "registry=https://unreviewed.example.test\n", /executables/],
  ]) {
    git(["checkout", "--detach", "-q", reviewed], f)
    f.put(path, text)
    const candidate = f.commit()
    git(["checkout", "--detach", "-q", reviewed], f)
    assert.throws(() => verifyQualificationSource(candidate, options), expected)
  }
  f.put("docs/operations/a.md", "# Candidate content\n")
  const candidate = f.commit()
  git(["checkout", "--detach", "-q", reviewed], f)
  assert.equal(
    verifyQualificationSource(candidate, options).candidateSha,
    candidate
  )
})

test("qualification binds all required workload inputs regardless of path or extension", (t) => {
  const f = fixture(t)
  const paths = [
    "scripts/check-env.mjs",
    "scripts/check-bundle-size.mjs",
    "scripts/check-agent-docs.mjs",
    "scripts/check-design-tokens.mjs",
    "scripts/run-supabase-sql.mjs",
    "scripts/ci/hosted-evidence.mjs",
    "tests/unit/coverage.test.mjs",
    "tests/contracts/required.test.mjs",
    "tests/db/required.test.mjs",
    "tests/support/register-alias.mjs",
    "tests/fixtures/expected-results.json",
    "ops/local-ci/core/workspace.mjs",
    "eslint.config.mjs",
    "knip.json",
    "jscpd.json",
    ".lighthouserc.json",
    ".github/actions/setup/action.yml",
    "supabase/config.toml",
    "supabase/seed.sql",
    "config/env-contract.json",
    "lib/env/validation.ts",
    "app/page.tsx",
    "docs/operations/hidden-executable.mjs",
    "unexpected-directory/required-input",
    "patches/minimatch@3.1.5.patch",
    "documentation draft/notes.md",
  ]
  for (const path of paths) f.put(path, "reviewed input\n")
  f.put(".github/workflows/ci.yml", "jobs: {}\n")
  f.put("config/ci-qualification-workflow.yml", "jobs: {}\n")
  const reviewed = f.commit()
  const options = { cwd: f.cwd, reviewedCwd: f.cwd }
  const result = verifyQualificationSource(reviewed, options)
  assert.equal(result.scope, "complete-tracked-input-tree")
  for (const path of paths) {
    f.put(path, "weakened check or expected result\n")
    const candidate = f.commit()
    git(["checkout", "--detach", "-q", reviewed], f)
    assert.throws(
      () => verifyQualificationSource(candidate, options),
      (error) => error.message.includes("differ from reviewed source: " + path)
    )
  }
  for (const change of [
    () => rmSync(join(f.cwd, paths[0])),
    () => chmodSync(join(f.cwd, paths[0]), 0o755),
    () => f.put("new-checker/without-extension", "unreviewed\n"),
    () => {
      f.put("docs/operations/executable.md", "# Executable content\n")
      chmodSync(join(f.cwd, "docs/operations/executable.md"), 0o755)
    },
  ]) {
    change()
    const candidate = f.commit()
    git(["checkout", "--detach", "-q", reviewed], f)
    assert.throws(
      () => verifyQualificationSource(candidate, options),
      /executables/
    )
  }
})

test("staged inputs bind future checkers and tests to separately reviewed exact blobs", (t) => {
  const f = fixture(t)
  const path = "scripts/check-env.mjs"
  const newTest = "tests/unit/future.test.mjs"
  const stagedPath = (path) =>
    "config/ci-qualification-inputs/" + path + ".source"
  const future = "console.log('run the reviewed future check')\n"
  f.put(".github/workflows/ci.yml", "jobs: { legacy: {} }\n")
  f.put("config/ci-qualification-workflow.yml", "jobs: { future: {} }\n")
  f.put(path, "console.log('run the existing check')\n")
  f.put(stagedPath(path), future)
  f.put(stagedPath(newTest), "console.log('run the reviewed future test')\n")
  const reviewed = f.commit()
  f.put(".github/workflows/ci.yml", "jobs: { future: {} }\n")
  f.put(path, future)
  f.put(newTest, "console.log('run the reviewed future test')\n")
  const candidate = f.commit()
  git(["checkout", "--detach", "-q", reviewed], f)
  const options = { cwd: f.cwd, reviewedCwd: f.cwd }
  assert.equal(verifyQualificationSource(candidate, options).stagedInputs, 2)
  for (const target of [path, newTest, stagedPath(path)]) {
    git(["checkout", "--detach", "-q", candidate], f)
    f.put(target, "console.log('success without validation')\n")
    const forged = f.commit()
    git(["checkout", "--detach", "-q", reviewed], f)
    assert.throws(
      () => verifyQualificationSource(forged, options),
      /executables/
    )
  }
  f.put(stagedPath(path), "dirty proposed checker\n")
  assert.throws(
    () => verifyQualificationSource(candidate, options),
    /differs in the verifier worktree/
  )
})

test("inert proposal updates retain all required checks before later activation is qualified", (t) => {
  const f = fixture(t)
  const paths = [
    "config/ci-qualification-workflow.yml",
    "config/ci-qualification-inputs/scripts/check-env.mjs.source",
  ]
  for (const path of paths) f.put(path, "existing proposal\n")
  const baseSha = f.commit()
  for (const path of paths) {
    f.put(path, "future proposal for separate review\n")
    const headSha = f.commit()
    const candidateSha = git(
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=ci@example.test",
        "commit-tree",
        `${headSha}^{tree}`,
        "-p",
        baseSha,
        "-p",
        headSha,
        "-m",
        "Merge proposal fixture",
      ],
      f
    ).trim()
    git(["checkout", "--detach", "-q", baseSha], f)
    const env = {
      GITHUB_REPOSITORY: "lapeninns/nabaperks",
      GITHUB_EVENT_NAME: "pull_request",
      CI_BASE_SHA: baseSha,
      CI_HEAD_SHA: headSha,
      GITHUB_SHA: candidateSha,
      CI_HEAD_REPOSITORY: "lapeninns/nabaperks",
    }
    const plan = planChecks(env, f)
    assert.equal(plan.profile, "full")
    assert.equal(plan.comparisonRequired, false)
    assert.equal(plan.required.length, 9)
    const evidence = {
      selection: { result: "success", outputs: { plan: JSON.stringify(plan) } },
      ...Object.fromEntries(
        ALL_WORKLOADS.map((name) => [
          name,
          {
            result: plan.required.includes(name) ? "success" : "skipped",
          },
        ])
      ),
      "selection-comparison": { result: "skipped" },
    }
    const options = { ...f, headRepository: env.CI_HEAD_REPOSITORY }
    assert.doesNotThrow(() =>
      verifyImpactEvidence(evidence, plan.identity, options)
    )
    evidence.fast.result = "skipped"
    assert.throws(() => verifyImpactEvidence(evidence, plan.identity, options))
  }
})

test("live input verification detects binary changes, executable modes and symlink substitution", (t) => {
  const f = fixture(t)
  f.put(".github/workflows/ci.yml", "jobs: {}\n")
  f.put("config/ci-qualification-workflow.yml", "jobs: {}\n")
  const path = "tests/fixtures/expected.bin"
  f.put(path, Buffer.from([0x80]))
  const reviewed = f.commit()
  const options = { cwd: f.cwd, reviewedCwd: f.cwd }
  assert.ok(verifyQualificationSource(reviewed, options))
  f.put(path, Buffer.from([0x81]))
  assert.throws(
    () => verifyQualificationSource(reviewed, options),
    /verifier worktree/
  )
  f.put(path, Buffer.from([0x80]))
  chmodSync(join(f.cwd, path), 0o755)
  assert.throws(
    () => verifyQualificationSource(reviewed, options),
    /input mode differs/
  )
  chmodSync(join(f.cwd, path), 0o644)
  rmSync(join(f.cwd, path))
  f.put("outside.bin", Buffer.from([0x80]))
  symlinkSync(join(f.cwd, "outside.bin"), join(f.cwd, path))
  assert.throws(
    () => verifyQualificationSource(reviewed, options),
    (error) => error.code === "ELOOP"
  )
})

test("a substituted FIFO fails reviewed input validation without blocking", (t) => {
  const f = fixture(t)
  f.put(".github/workflows/ci.yml", "jobs: {}\n")
  f.put("config/ci-qualification-workflow.yml", "jobs: {}\n")
  const path = join(f.cwd, "scripts/check.mjs")
  f.put("scripts/check.mjs", "reviewed input\n")
  const reviewed = f.commit()
  rmSync(path)
  assert.equal(spawnSync("mkfifo", [path]).status, 0)
  const verifierModuleUrl = new URL(
    "../../scripts/ci/qualification-source.mjs",
    import.meta.url
  ).href
  const options = JSON.stringify({ cwd: f.cwd, reviewedCwd: f.cwd })
  const code = `import { verifyQualificationSource } from ${JSON.stringify(verifierModuleUrl)};
    try { verifyQualificationSource(${JSON.stringify(reviewed)}, ${options}) }
    catch (error) { if (/not a regular file/.test(error.message)) process.exit(42); throw error }`
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      encoding: "utf8",
      timeout: 5000,
    }
  )
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null)
  assert.equal(result.status, 42, result.stderr)
})

test("reviewed documentation checks candidate content without executing its checker or formatter config", (t) => {
  const f = fixture(t),
    marker = join(f.cwd, "candidate-executed")
  const evil = `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed');\n`
  f.put(
    "scripts/ci/documentation-checks.mjs",
    evil + "export function runDocumentation() { return {passed:true} }\n"
  )
  f.put(".prettierrc.mjs", evil + "export default {}\n")
  f.put(".prettierignore", "**/*\n")
  f.put("docs/operations/a.md", "# Valid\n")
  let candidate = f.commit()
  const files = [{ path: "docs/operations/a.md" }]
  const result = qualifyReviewedDocumentation(candidate, files, f)
  assert.equal(result.cases.length, 8)
  assert.equal(result.changedFiles.passed, true)
  assert.equal(existsSync(marker), false)
  for (const text of [
    "#   Bad formatting\n",
    "# Broken\n\n[Missing](missing.md)\n",
  ]) {
    f.put("docs/operations/a.md", text)
    candidate = f.commit()
    assert.throws(
      () => qualifyReviewedDocumentation(candidate, files, f),
      /failed reviewed validation/
    )
    assert.equal(existsSync(marker), false)
  }
  // A candidate does not need a checker module: the reference is in reviewed code.
  rmSync(join(f.cwd, "scripts/ci/documentation-checks.mjs"))
  f.put("docs/operations/a.md", "# Valid again\n")
  candidate = f.commit()
  assert.equal(
    qualifyReviewedDocumentation(candidate, files, f).changedFiles.passed,
    true
  )
  assert.equal(existsSync(marker), false)
})

test("the staged selective gate rebinds every plan field to actual Git objects", (t) => {
  const f = fixture(t)
  f.put("docs/operations/a.md", "# Before\n")
  const baseSha = f.commit()
  f.put("docs/operations/a.md", "# After\n")
  const headSha = f.commit()
  const candidateSha = git(
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=ci@example.test",
      "commit-tree",
      `${headSha}^{tree}`,
      "-p",
      baseSha,
      "-p",
      headSha,
      "-m",
      "Merge fixture",
    ],
    f
  ).trim()
  git(["checkout", "--detach", "-q", baseSha], f)
  const env = {
    GITHUB_REPOSITORY: "lapeninns/nabaperks",
    GITHUB_EVENT_NAME: "pull_request",
    CI_BASE_SHA: baseSha,
    CI_HEAD_SHA: headSha,
    GITHUB_SHA: candidateSha,
    CI_HEAD_REPOSITORY: "lapeninns/nabaperks",
  }
  const plan = planChecks(env, f)
  assert.equal(plan.profile, "documentation")
  const evidence = {
    selection: { result: "success", outputs: { plan: JSON.stringify(plan) } },
    ...Object.fromEntries(
      ALL_WORKLOADS.map((name) => [
        name,
        { result: plan.required.includes(name) ? "success" : "skipped" },
      ])
    ),
    "selection-comparison": { result: "skipped" },
  }
  const options = { ...f, headRepository: env.CI_HEAD_REPOSITORY }
  assert.match(
    verifyImpactEvidence(evidence, plan.identity, options),
    /db: not required/
  )
  for (const patch of [
    { changeDigest: "a".repeat(64) },
    { policyDigest: "b".repeat(64) },
    { changes: [{ path: "README.md" }] },
  ]) {
    const forged = structuredClone(evidence)
    forged.selection.outputs.plan = JSON.stringify({ ...plan, ...patch })
    assert.throws(
      () => verifyImpactEvidence(forged, plan.identity, options),
      /immutable Git classification/
    )
  }
})
