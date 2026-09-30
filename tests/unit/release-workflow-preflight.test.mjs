import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const read = (name) =>
  readFileSync(
    new URL(`../../.github/workflows/${name}`, import.meta.url),
    "utf8"
  )
const deploy = read("production-deploy.yml")
const owner = read("production-database.yml")
const script = deploy.match(
  /      - name: Require the bound production release owner\n        run: \|\n([\s\S]*?)\n  deploy:/
)?.[1]
assert.ok(script, "must execute the real callee preflight")
const preflight = script
  .split("\n")
  .map((line) => line.replace(/^          /, ""))
  .join("\n")
const sha = "a".repeat(40)
const automatic = {
  GITHUB_REPOSITORY: "lapeninns/nabaperks",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
  RELEASE_RUN_ID: "123",
  RELEASE_RUN_ATTEMPT: "1",
  EXPECTED_REVISION: sha,
  GITHUB_EVENT_NAME: "workflow_run",
  SOURCE_CONCLUSION: "success",
  SOURCE_BRANCH: "main",
  SOURCE_EVENT: "push",
  SOURCE_WORKFLOW: `CI head:${sha} base:${sha}`,
  SOURCE_RUN_ID: "456",
  SOURCE_PATH: ".github/workflows/ci.yml",
  SOURCE_REPOSITORY: "lapeninns/nabaperks",
  SOURCE_REVISION: sha,
  CALLER_PATH: ".github/workflows/production-database.yml",
}

test("release attempt input accepts GitHub's string context on initial and retried runs", () => {
  // GitHub validates reusable inputs before running the shell preflight. Its
  // run_attempt context is a string even though it contains a decimal number.
  assert.match(
    deploy,
    /release_run_attempt:\n        required: true\n        type: string/
  )
  assert.match(owner, /release_run_attempt: \$\{\{ github\.run_attempt \}\}/)
  for (const attempt of ["1", "2", "10"]) {
    const context = { ...automatic, GITHUB_RUN_ATTEMPT: attempt }
    assert.equal(run({ ...context, RELEASE_RUN_ATTEMPT: attempt }), 0)
    assert.notEqual(run({ ...context, RELEASE_RUN_ATTEMPT: "stale" }), 0)
  }
})

function run(env) {
  const dir = mkdtempSync(join(tmpdir(), "release-preflight-"))
  try {
    writeFileSync(
      join(dir, "gh"),
      '#!/bin/sh\ncase "$2" in\n */456) test "$SOURCE_LOOKUP_FAIL" != 1 || exit 1; printf "%s\\n" "$SOURCE_PATH" ;;\n *) printf "%s\\n" "$CALLER_PATH" ;;\nesac\n',
      { mode: 0o700 }
    )
    return spawnSync(
      "/bin/bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", preflight],
      {
        env: { PATH: `${dir}:/usr/bin:/bin`, ...env },
        encoding: "utf8",
        timeout: 5000,
      }
    ).status
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("real release preflight accepts only bound automatic CI source", () => {
  assert.equal(run(automatic), 0)
  for (const [key, value] of Object.entries({
    CALLER_PATH: ".github/workflows/unrelated.yml",
    GITHUB_REPOSITORY: "foreign/repository",
    RELEASE_RUN_ID: "124",
    RELEASE_RUN_ATTEMPT: "2",
    EXPECTED_REVISION: "short",
    SOURCE_CONCLUSION: "failure",
    SOURCE_BRANCH: "feature",
    SOURCE_EVENT: "pull_request",
    SOURCE_RUN_ID: "",
    SOURCE_PATH: ".github/workflows/unrelated.yml",
    SOURCE_LOOKUP_FAIL: "1",
    SOURCE_REPOSITORY: "foreign/repository",
    SOURCE_REVISION: "b".repeat(40),
    GITHUB_EVENT_NAME: "workflow_call",
  }))
    assert.notEqual(run({ ...automatic, [key]: value }), 0, key)
})

test("manual release requires the outer confirmation and exact main tip", () => {
  const manual = {
    ...automatic,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: sha,
    CONFIRMATION: "PROMOTE_PRODUCTION_DATABASE",
  }
  assert.equal(run(manual), 0)
  for (const [key, value] of Object.entries({
    CONFIRMATION: "PROMOTE_PRODUCTION_APPLICATION",
    GITHUB_REF: "refs/heads/feature",
    GITHUB_SHA: "b".repeat(40),
  }))
    assert.notEqual(run({ ...manual, [key]: value }), 0, key)
})

const ELIGIBLE_SOURCE =
  "github.event_name != 'workflow_run' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.head_repository.full_name == github.repository && github.event.workflow_run.path == '.github/workflows/ci.yml')"

test("one outer lock spans successful database application through public verification", () => {
  // Only an eligible source joins the shared lock; an ineligible CI completion
  // gets a private group so it cannot displace a pending release.
  assert.ok(
    owner.includes(
      `concurrency:\n  group: \${{ (${ELIGIBLE_SOURCE}) && 'production-release' || format('production-release-ineligible-{0}', github.run_id) }}\n  cancel-in-progress: false`
    ),
    "release lock must be conditional on the same eligibility as preflight"
  )
  assert.ok(
    owner.includes(
      `  preflight:\n    name: Production database preflight\n    if: \${{ ${ELIGIBLE_SOURCE} }}\n`
    ),
    "ineligible sources must skip rather than fail the release"
  )
  assert.match(
    owner,
    /  application:\n    name: [^\n]+\n    needs: promote\n    uses: \.\/\.github\/workflows\/production-deploy.yml/
  )
  assert.doesNotMatch(
    deploy,
    /^concurrency:|^  workflow_dispatch:|^  workflow_run:/m
  )
  assert.match(deploy, /^  workflow_call:/m)
  assert.match(deploy, /environment: Production/)
  const promote = deploy.indexOf('pnpm exec vercel promote "$deployment_id"')
  const publicProbe = deploy.indexOf(
    "Verify the exact promoted public revision under the release lock"
  )
  const artifact = deploy.indexOf(
    "Retain the exact successfully promoted candidate"
  )
  assert.ok(promote > 0 && publicProbe > promote && artifact > publicProbe)
  for (const workflow of [
    "admin-mfa-bootstrap.yml",
    "admin-mfa-activation.yml",
  ])
    assert.match(read(workflow), /group: production-release/)
})

test("downstream smoke authenticates actual deployed candidate instead of outer workflow SHA", () => {
  const smoke = read("production-smoke.yml")
  assert.match(smoke, /workflows: \["Production database promotion"\]/)
  assert.match(
    smoke,
    /ref: \$\{\{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha \|\| github.sha \}\}/
  )
  assert.doesNotMatch(smoke, /EXPECTED_REVISION:.*workflow_run\.head_sha/)
  assert.match(smoke, /run: node scripts\/release\/read-candidate-artifact.mjs/)
  assert.ok(
    smoke.indexOf("read-candidate-artifact.mjs") <
      smoke.indexOf("Verify public liveness")
  )
  assert.match(smoke, /actions: read/)
})

const sourceStep = owner
  .match(
    /      - name: Require an approved automatic or manual source\n        run: \|\n([\s\S]*?)\n      - name:/
  )?.[1]
  ?.split("\n")
  .map((line) => line.replace(/^          /, ""))
  .join("\n")

function runSource(env) {
  return spawnSync(
    "/bin/bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", sourceStep],
    { env: { PATH: "/usr/bin:/bin", ...env }, encoding: "utf8", timeout: 5000 }
  ).status
}

test("database preflight re-proves the automatic source identity in the shell", () => {
  assert.ok(sourceStep, "must execute the real database preflight step")
  const eligible = {
    GITHUB_EVENT_NAME: "workflow_run",
    GITHUB_REPOSITORY: "lapeninns/nabaperks",
    EXPECTED_REVISION: sha,
    SOURCE_CONCLUSION: "success",
    SOURCE_EVENT: "push",
    SOURCE_BRANCH: "main",
    SOURCE_REPOSITORY: "lapeninns/nabaperks",
    SOURCE_PATH: ".github/workflows/ci.yml",
  }
  assert.equal(runSource(eligible), 0)
  for (const [name, value] of [
    ["SOURCE_CONCLUSION", "failure"],
    ["SOURCE_CONCLUSION", "cancelled"],
    ["SOURCE_EVENT", "pull_request"],
    ["SOURCE_BRANCH", "feature"],
    ["SOURCE_REPOSITORY", "attacker/nabaperks"],
    ["SOURCE_PATH", ".github/workflows/other.yml"],
    ["EXPECTED_REVISION", "main"],
    ["EXPECTED_REVISION", `${sha}; true`],
  ])
    assert.notEqual(runSource({ ...eligible, [name]: value }), 0, name)
  const manual = {
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: sha,
    EXPECTED_REVISION: sha,
    CONFIRMATION: "PROMOTE_PRODUCTION_DATABASE",
  }
  assert.equal(runSource(manual), 0)
  assert.notEqual(runSource({ ...manual, CONFIRMATION: "yes" }), 0)
  assert.notEqual(runSource({ ...manual, GITHUB_REF: "refs/heads/x" }), 0)
  assert.notEqual(
    runSource({ ...manual, EXPECTED_REVISION: "b".repeat(40) }),
    0
  )
  assert.notEqual(runSource({ ...manual, GITHUB_EVENT_NAME: "schedule" }), 0)
})

test("promotion re-reads live main immediately before the irreversible step", () => {
  const promote = deploy.indexOf('pnpm exec vercel promote "$deployment_id"')
  const recheck = deploy.lastIndexOf(
    'live_main="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main"',
    promote
  )
  assert.ok(recheck > 0 && recheck < promote)
  assert.ok(deploy.slice(recheck, promote).includes("refusing a stale release"))
  assert.doesNotMatch(deploy, /--token=/)
})

test("database writes re-read live main before the first irreversible step", () => {
  const push = owner.indexOf("run: supabase db push --linked --include-all")
  const recheck = owner.lastIndexOf(
    'live_main="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main"',
    push
  )
  const dryRun = owner.indexOf("supabase db push --linked --dry-run")
  assert.ok(dryRun > 0 && recheck > dryRun && recheck < push)
  assert.ok(owner.slice(recheck, push).includes("refusing a stale release"))
})
