import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { git } from "../../scripts/ci/impact-git.mjs"
import { impactPolicy } from "../../scripts/ci/change-impact.mjs"
import { planChecks } from "../../scripts/ci/plan-checks.mjs"
import {
  ALL_WORKLOADS,
  FULL_WORKLOADS,
} from "../../scripts/ci/impact-plan-contract.mjs"
import { verifyImpactEvidence } from "../../scripts/ci/verify-impact-evidence.mjs"

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "ci-main-qualification-"))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const put = (path, text) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    writeFileSync(join(cwd, path), text)
  }
  git(["init", "-q"], { cwd })
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
  put("config/ci-impact-policy.json", JSON.stringify(impactPolicy))
  put(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } })
  )
  put(
    "app/about/page.tsx",
    "export default function Page() { return <p>Hello</p> }"
  )
  return { cwd, put, commit }
}

function evidenceFor(plan) {
  return {
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
}

test("exact-main requires all nine roots without activating frozen future proposals; PRs changing CI inputs run every workload", (t) => {
  const f = fixture(t)
  const paths = [
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/ci/plan-checks.mjs",
  ]
  for (const path of paths) f.put(path, "reviewed input\n")
  const baseSha = f.commit()
  for (const path of paths) f.put(path, "updated input\n")
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
      "merge candidate",
    ],
    f
  ).trim()
  const env = {
    GITHUB_REPOSITORY: "lapeninns/nabaperks",
    GITHUB_EVENT_NAME: "pull_request",
    CI_BASE_SHA: baseSha,
    CI_HEAD_SHA: headSha,
    GITHUB_SHA: candidateSha,
    CI_HEAD_REPOSITORY: "lapeninns/nabaperks",
  }
  git(["checkout", "--detach", "-q", baseSha], f)
  for (const repository of [env.CI_HEAD_REPOSITORY, "external/fork"]) {
    const pr = planChecks({ ...env, CI_HEAD_REPOSITORY: repository }, f)
    // CI-input changes run every workload; they no longer demand an exact
    // staged-tree comparison (docs/decisions/ci-qualification-replacement.md).
    assert.equal(pr.comparisonRequired, false)
    assert.equal(pr.qualificationPages, undefined)
    assert.equal(pr.profile, "full")
    assert.deepEqual(pr.required, FULL_WORKLOADS)
  }
  git(["checkout", "--detach", "-q", candidateSha], f)
  const mainEnv = {
    ...env,
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    CI_HEAD_SHA: candidateSha,
  }
  const main = planChecks(mainEnv, f)
  assert.equal(main.comparisonRequired, false)
  assert.equal(main.profile, "full")
  assert.deepEqual(main.required, FULL_WORKLOADS)
  assert.equal(main.qualificationPages, undefined)
  const evidence = evidenceFor(main)
  assert.match(verifyImpactEvidence(evidence, main.identity, f), /db: passed/)
  for (const name of FULL_WORKLOADS) {
    for (const result of ["failure", "skipped", "cancelled"]) {
      const failed = structuredClone(evidence)
      failed[name].result = result
      assert.throws(
        () => verifyImpactEvidence(failed, main.identity, f),
        /successful execution required/
      )
    }
  }
  const missing = structuredClone(evidence)
  delete missing.db
  assert.throws(
    () => verifyImpactEvidence(missing, main.identity, f),
    /missing CI jobs/
  )
  assert.throws(
    () => planChecks({ ...mainEnv, GITHUB_REF: "refs/heads/other" }, f),
    /Only main pushes/
  )
  assert.throws(() => planChecks({ ...mainEnv, CI_HEAD_SHA: headSha }, f))
})

test("uncertain main inventory retains full validation without requesting PR activation proof", (t) => {
  const f = fixture(t)
  const baseSha = f.commit()
  rmSync(join(f.cwd, "tsconfig.json"))
  symlinkSync("missing.json", join(f.cwd, "tsconfig.json"))
  const candidateSha = f.commit()
  const plan = planChecks(
    {
      GITHUB_REPOSITORY: "lapeninns/nabaperks",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      CI_BASE_SHA: baseSha,
      CI_HEAD_SHA: candidateSha,
      GITHUB_SHA: candidateSha,
    },
    f
  )
  assert.equal(plan.profile, "full")
  assert.match(plan.reason, /Change inventory unavailable/)
  assert.equal(plan.comparisonRequired, false)
  assert.deepEqual(plan.required, FULL_WORKLOADS)
})
