import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
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
  assert.equal(verifyQualificationSource(reviewed, options).executionInputs, 1)
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
