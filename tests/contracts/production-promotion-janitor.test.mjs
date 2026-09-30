import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const WORKFLOW = ".github/workflows/production-promotion-janitor.yml"
const SCRIPT = "scripts/release/promotion-janitor.mjs"

function read(path) {
  return readFileSync(path, "utf8")
}

test("the promotion janitor runs on a 15-minute schedule, on every new promotion and on demand", () => {
  const workflow = read(WORKFLOW)

  assert.match(
    workflow,
    /\non:\n  schedule:\n    - cron: "9\/15 \* \* \* \*"\n/
  )
  // GitHub delivers this repository's schedules sparsely, so a new promotion
  // queuing behind a stale approval also wakes the janitor.
  assert.match(
    workflow,
    /\n  workflow_run:\n    workflows: \["Production database promotion"\]\n    types: \[requested\]\n/
  )
  assert.match(workflow, /\n  workflow_dispatch:\n/)
  assert.doesNotMatch(workflow, /\n  (push|pull_request|pull_request_target):/)
  assert.match(
    workflow,
    /\nconcurrency:\n  group: production-promotion-janitor\n  cancel-in-progress: true\n/
  )
})

test("only the janitor job can cancel runs or review deployments", () => {
  const workflow = read(WORKFLOW)
  const jobs = workflow.slice(workflow.indexOf("\njobs:\n"))

  assert.match(workflow, /\npermissions:\n  contents: read\n\njobs:\n/)
  assert.equal([...jobs.matchAll(/\n  [a-z][a-z-]*:\n/g)].length, 1)
  assert.match(jobs, /\n  janitor:\n/)
  assert.match(
    jobs,
    /\n    permissions:\n      contents: read\n      actions: write\n      deployments: write\n    steps:/
  )
  assert.equal([...workflow.matchAll(/^ +[a-z-]+: write$/gm)].length, 2)
  assert.doesNotMatch(workflow, /issues: write|checks: write|contents: write/)
  assert.doesNotMatch(workflow, /environment:/)
  assert.doesNotMatch(workflow, /secrets\./)
  assert.match(jobs, /\n    runs-on: ubuntu-latest\n/)
  assert.match(jobs, /\n    timeout-minutes: 5\n/)
})

test("the janitor uses the repository's pinned actions and env indirection", () => {
  const workflow = read(WORKFLOW)

  assert.match(
    workflow,
    /uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\n        with:\n          persist-credentials: false\n/
  )
  assert.match(
    workflow,
    /uses: actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7\n        with:\n          node-version-file: \.nvmrc\n/
  )
  const runStep = workflow.match(
    /\n        env:\n          GH_TOKEN: \$\{\{ github\.token \}\}\n        run: (.+)\n/
  )
  assert.ok(runStep, "janitor step must pass the token through env")
  assert.equal(runStep[1], "node scripts/release/promotion-janitor.mjs")
  for (const [, command] of workflow.matchAll(/\n\s+run: (.*)/g))
    assert.doesNotMatch(command, /\$\{\{/)
  assert.doesNotMatch(workflow, /--dry-run/)
})

test("the janitor targets one repository, workflow and environment", () => {
  const script = read(SCRIPT)

  assert.match(script, /EXPECTED_REPOSITORY = "lapeninns\/nabaperks"/)
  assert.match(
    script,
    /PROMOTION_WORKFLOW_PATH =\s+"\.github\/workflows\/production-database\.yml"/
  )
  assert.match(script, /APPROVAL_ENVIRONMENT = "Production approval"/)
  assert.doesNotMatch(script, /=== "Production"|ENVIRONMENT = "Production"\n/)
  assert.match(script, /API_VERSION = "2026-03-10"/)
  assert.match(script, /"x-github-api-version": API_VERSION/i)
  assert.match(script, /redirect: "error"/)
  assert.match(script, /state: "rejected"/)
  assert.match(script, /\/cancel`/)
  assert.match(script, /--dry-run/)
  assert.match(script, /GITHUB_STEP_SUMMARY/)
  assert.match(script, /::notice/)
  assert.match(script, /::\$\{level\} title=Promotion janitor::/)
  assert.match(script, /"warning"/)
  assert.doesNotMatch(
    script,
    /state: "approved"|force-cancel|\/rerun|\/approve/
  )
  assert.doesNotMatch(script, /from "(?!node:)/)
})

test("the stale threshold stays coupled to the release evidence expiry", () => {
  const script = read(SCRIPT)
  const manifest = read("scripts/release/manifest.mjs")

  assert.match(manifest, /maxAgeMs = 3_600_000/)
  assert.match(script, /EVIDENCE_MAX_AGE_MS = 3_600_000/)
  assert.match(
    script,
    /JANITOR_STALE_MS = EVIDENCE_MAX_AGE_MS \+ APPROVAL_HEADROOM_MS/
  )
  assert.match(script, /APPROVAL_HEADROOM_MS = 15 \* 60_000/)
  assert.match(script, /maxAgeMs 3600000/)
})

test("the runbook documents the janitor and approval waits outside timeouts", () => {
  const runbook = read("docs/operations/production-runbook.md")
  const readiness = read("docs/operations/agent-readiness.md")

  assert.match(runbook, /production-promotion-janitor\.yml/)
  assert.match(runbook, /every\s+15\s+minutes/)
  assert.match(runbook, /more\s+than\s+75\s+minutes/)
  assert.match(runbook, /fresh\s+complete\s+outer\s+run/)
  assert.match(
    runbook,
    /approval\s+waiting\s+time\s+does\s+not\s+count\s+against\s+`timeout-minutes`/i
  )
  assert.match(runbook, /--dry-run/)
  assert.match(readiness, /\| Stuck promotion janitor +\|/)
})
