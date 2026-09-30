import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { git } from "../../scripts/ci/impact-git.mjs"
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
