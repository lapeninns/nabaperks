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
  SOURCE_WORKFLOW: "CI",
  SOURCE_REPOSITORY: "lapeninns/nabaperks",
  SOURCE_REVISION: sha,
  CALLER_PATH: ".github/workflows/production-database.yml",
}

function run(env) {
  const dir = mkdtempSync(join(tmpdir(), "release-preflight-"))
  try {
    writeFileSync(
      join(dir, "gh"),
      '#!/bin/sh\nprintf "%s\\n" "$CALLER_PATH"\n',
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
    SOURCE_WORKFLOW: "Unrelated",
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

test("one outer lock spans successful database application through public verification", () => {
  assert.match(
    owner,
    /concurrency:\n  group: production-release\n  cancel-in-progress: false/
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
  assert.doesNotMatch(smoke, /workflow_run\.head_sha/)
  assert.match(smoke, /run: node scripts\/release\/read-candidate-artifact.mjs/)
  assert.ok(
    smoke.indexOf("read-candidate-artifact.mjs") <
      smoke.indexOf("Verify public liveness")
  )
  assert.match(smoke, /actions: read/)
})
