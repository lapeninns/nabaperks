import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"

// One human decision per production release. The secret-free
// `Production approval` environment carries the only required reviewer; the
// `Production` environment keeps the credentials and no longer pauses. These
// contracts read every workflow so that a new or edited job cannot reach
// production credentials for a write without passing the approval job.

const WORKFLOWS = ".github/workflows"
const APPROVAL = "Production approval"
const CREDENTIALS = "Production"
// The baseline reader authenticates the live Vercel alias before the release
// proof exists. It holds a read-only use of VERCEL_TOKEN and must stay that way.
const READ_ONLY_BEFORE_APPROVAL = new Set(["production-database.yml#baseline"])
const KNOWN_ENVIRONMENTS = new Set([
  APPROVAL,
  CREDENTIALS,
  "Monitoring",
  "Recovery Drill",
  "Staging",
])

function readWorkflows() {
  return new Map(
    readdirSync(WORKFLOWS)
      .filter((file) => /\.ya?ml$/.test(file))
      .sort()
      .map((file) => [file, readFileSync(`${WORKFLOWS}/${file}`, "utf8")])
  )
}

// The workflows are plain two-space YAML, so a job starts at a two-space key
// under `jobs:` and its own keys sit at four spaces.
function parseJobs(text) {
  const marker = text.indexOf("\njobs:\n")
  assert.ok(marker >= 0, "workflow has a jobs map")
  const body = text.slice(marker + "\njobs:\n".length)
  const starts = [...body.matchAll(/^ {2}([a-z0-9_-]+):\n/gm)]
  return new Map(
    starts.map((match, index) => {
      const block = body.slice(
        match.index,
        starts[index + 1]?.index ?? body.length
      )
      const key = (name) =>
        block.match(new RegExp(`^ {4}${name}:(?: (.*))?$`, "m"))
      const needs = key("needs")?.[1] ?? ""
      return [
        match[1],
        {
          block,
          environment: key("environment")
            ? (key("environment")[1] ?? "")
            : null,
          needs: needs
            .replace(/^\[|\]$/g, "")
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
          condition: key("if")?.[1] ?? null,
          uses: key("uses")?.[1] ?? null,
        },
      ]
    })
  )
}

function ancestors(jobs, id, seen = new Set()) {
  for (const parent of jobs.get(id)?.needs ?? []) {
    if (seen.has(parent)) continue
    seen.add(parent)
    ancestors(jobs, parent, seen)
  }
  return seen
}

function approvedBy(jobs, id) {
  return [...ancestors(jobs, id)].filter(
    (parent) => jobs.get(parent)?.environment === APPROVAL
  )
}

function triggers(text) {
  // The `on:` map ends at the next top-level key, such as `permissions:`.
  const start = text.indexOf("\non:\n")
  assert.ok(start >= 0, "workflow declares its triggers")
  const rest = text.slice(start + "\non:\n".length)
  const on = rest.slice(0, rest.search(/^[a-z]/m))
  return [...on.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1])
}

function productionGateViolations(workflows) {
  const violations = []
  const parsed = new Map(
    [...workflows].map(([file, text]) => [file, parseJobs(text)])
  )
  for (const [file, jobs] of parsed) {
    for (const [id, job] of jobs) {
      const where = `${file}#${id}`
      if (job.environment === null) continue
      if (!KNOWN_ENVIRONMENTS.has(job.environment))
        violations.push(`${where}: unreviewed environment ${job.environment}`)
      if (job.environment === APPROVAL) {
        if (!/^ {4}permissions: \{\}$/m.test(job.block))
          violations.push(`${where}: approval job must drop token permissions`)
        if (/secrets\.|vars\.|^\s+(?:- )?uses:/m.test(job.block))
          violations.push(
            `${where}: approval job must not run code or read secrets`
          )
        continue
      }
      if (job.environment !== CREDENTIALS) continue
      if (READ_ONLY_BEFORE_APPROVAL.has(where)) continue
      if (approvedBy(jobs, id).length) {
        if (
          !job.block.includes(
            "APPROVED_RUN_ATTEMPT: ${{ needs.approval.outputs.run_attempt }}"
          )
        )
          violations.push(`${where}: approval is not bound to this run attempt`)
        continue
      }
      // A reusable workflow is only as gated as every job that calls it.
      const callable = triggers(workflows.get(file))
      const callers = [...parsed].flatMap(([callerFile, callerJobs]) =>
        [...callerJobs]
          .filter(([, caller]) => caller.uses === `./${WORKFLOWS}/${file}`)
          .map(([callerId]) => [callerFile, callerJobs, callerId])
      )
      const reusableAndGated =
        callable.length === 1 &&
        callable[0] === "workflow_call" &&
        callers.length > 0 &&
        callers.every(
          ([, callerJobs, callerId]) =>
            approvedBy(callerJobs, callerId).length > 0
        )
      if (!reusableAndGated)
        violations.push(
          `${where}: uses ${CREDENTIALS} without the approval job`
        )
    }
  }
  return violations
}

const workflows = readWorkflows()
const database = parseJobs(workflows.get("production-database.yml"))

test("every job that can write with Production credentials follows the single approval", () => {
  assert.deepEqual(productionGateViolations(workflows), [])

  const credentialJobs = [...workflows].flatMap(([file, text]) =>
    [...parseJobs(text)]
      .filter(([, job]) => job.environment === CREDENTIALS)
      .map(([id]) => `${file}#${id}`)
  )
  assert.deepEqual(credentialJobs.sort(), [
    "admin-mfa-activation.yml#activate",
    "admin-mfa-bootstrap.yml#publish",
    "production-database.yml#baseline",
    "production-database.yml#promote",
    "production-deploy.yml#deploy",
  ])
  // The environment is always named literally so this contract can see it.
  for (const [file, text] of workflows)
    assert.doesNotMatch(
      text,
      /^\s+environment:\s*(?:\n|\$\{\{)/m,
      `${file} must name its environment literally`
    )
})

test("the release path pauses exactly once, after proof and before the first write", () => {
  const approvals = [...database].filter(
    ([, job]) => job.environment === APPROVAL
  )
  assert.deepEqual(
    approvals.map(([id]) => id),
    ["approval"]
  )
  const approval = database.get("approval")
  const promote = database.get("promote")
  assert.match(approval.block, /name: Approve production release\n/)
  assert.deepEqual(approval.needs, ["baseline", "qualification"])
  assert.equal(approval.condition, promote.condition)
  assert.equal(
    approval.condition,
    "${{ needs.baseline.outputs.application_required == 'true' }}"
  )
  assert.deepEqual(promote.needs, ["baseline", "qualification", "approval"])
  assert.deepEqual(database.get("application").needs, ["promote"])
  assert.equal(
    database.get("application").uses,
    "./.github/workflows/production-deploy.yml"
  )
  // Proof and qualification finish before the reviewer is asked.
  for (const proof of ["preflight", "baseline", "staging", "qualification"])
    assert.ok(ancestors(database, "approval").has(proof), proof)

  const guard = promote.block.indexOf(
    "      - name: Require the release approval from this run attempt\n"
  )
  const firstStep = promote.block.indexOf("\n      - ")
  assert.equal(guard, firstStep + 1)
  assert.match(
    promote.block,
    /"\$APPROVED_REVISION" != "\$EXPECTED_REVISION" \|\| "\$APPROVED_RUN_ATTEMPT" != "\$RELEASE_RUN_ATTEMPT"/
  )
  assert.match(
    approval.block,
    /printf 'revision=%s\\nrun_attempt=%s\\n' "\$EXPECTED_REVISION" "\$RELEASE_RUN_ATTEMPT" >> "\$GITHUB_OUTPUT"/
  )
  assert.ok(
    promote.block.indexOf("Require the release approval") <
      promote.block.indexOf("supabase link") &&
      promote.block.indexOf("Require the release approval") <
        promote.block.indexOf("db push --linked --include-all")
  )
})

test("the pre-approval baseline reader stays read-only", () => {
  const baseline = database.get("baseline")
  assert.deepEqual(
    [...new Set(baseline.block.match(/secrets\.[A-Z_]+/g))],
    ["secrets.VERCEL_TOKEN"]
  )
  assert.deepEqual(
    [...baseline.block.matchAll(/node (scripts\/\S+)/g)].map(
      (match) => match[1]
    ),
    [
      "scripts/release/deployed-baseline.mjs",
      "scripts/release/no-deployment.mjs",
    ]
  )
  assert.doesNotMatch(
    baseline.block,
    /supabase |db push|vercel (?:deploy|promote|alias)|--request (?:POST|PATCH|PUT|DELETE)|SUPABASE_/
  )
  const reader = readFileSync("scripts/release/deployed-baseline.mjs", "utf8")
  assert.doesNotMatch(reader, /method:\s*"(?:POST|PATCH|PUT|DELETE)"/)
})

test("the reusable deployment cannot run outside the approved release owner", () => {
  const text = workflows.get("production-deploy.yml")
  assert.deepEqual(triggers(text), ["workflow_call"])
  assert.match(
    text,
    /test "\$caller_path" = "\.github\/workflows\/production-database\.yml"/
  )
  assert.match(text, /test "\$RELEASE_RUN_ATTEMPT" = "\$GITHUB_RUN_ATTEMPT"/)
  // The deploy job consumes the database stage that only an approved promote
  // in this same attempt can upload.
  assert.match(
    text,
    /name: production-database-stage-\$\{\{ inputs\.release_run_id \}\}-\$\{\{ inputs\.release_run_attempt \}\}/
  )
  const callers = [...workflows].filter(([, workflow]) =>
    workflow.includes("uses: ./.github/workflows/production-deploy.yml")
  )
  assert.deepEqual(
    callers.map(([file]) => file),
    ["production-database.yml"]
  )
})

test("privileged admin MFA operations keep their own approval", () => {
  for (const [file, privileged, name] of [
    ["admin-mfa-activation.yml", "activate", "Approve admin MFA activation"],
    ["admin-mfa-bootstrap.yml", "publish", "Approve admin MFA bootstrap"],
  ]) {
    const jobs = parseJobs(workflows.get(file))
    assert.deepEqual([...jobs.keys()], ["approval", privileged], file)
    assert.equal(jobs.get("approval").environment, APPROVAL, file)
    assert.match(jobs.get("approval").block, new RegExp(`name: ${name}\\n`))
    assert.deepEqual(jobs.get(privileged).needs, ["approval"], file)
    assert.equal(jobs.get(privileged).environment, CREDENTIALS, file)
    const block = jobs.get(privileged).block
    assert.equal(
      block.indexOf(
        "      - name: Require the approval from this run attempt\n"
      ),
      block.indexOf("\n      - ") + 1,
      file
    )
    assert.match(
      block,
      /"\$APPROVED_RUN_ATTEMPT" != "\$GITHUB_RUN_ATTEMPT"/,
      file
    )
  }
})

test("the gate check rejects credential jobs that skip or unbind the approval", () => {
  const mutate = (file, from, to) => {
    const copy = new Map(workflows)
    const text = copy.get(file)
    assert.ok(text.includes(from), `${file} contains the mutated text`)
    copy.set(file, text.replace(from, to))
    return productionGateViolations(copy)
  }

  assert.deepEqual(
    mutate(
      "production-database.yml",
      "needs: [baseline, qualification, approval]",
      "needs: [baseline, qualification]"
    ),
    [
      "production-database.yml#promote: uses Production without the approval job",
      "production-deploy.yml#deploy: uses Production without the approval job",
    ]
  )
  assert.deepEqual(
    mutate("admin-mfa-bootstrap.yml", "    needs: approval\n", ""),
    [
      "admin-mfa-bootstrap.yml#publish: uses Production without the approval job",
    ]
  )
  assert.deepEqual(
    mutate(
      "admin-mfa-activation.yml",
      "      APPROVED_RUN_ATTEMPT: ${{ needs.approval.outputs.run_attempt }}\n",
      ""
    ),
    [
      "admin-mfa-activation.yml#activate: approval is not bound to this run attempt",
    ]
  )
  assert.deepEqual(
    mutate(
      "production-database.yml",
      "    environment: Production approval\n",
      "    environment: Production\n"
    ),
    [
      "production-database.yml#approval: uses Production without the approval job",
      "production-database.yml#promote: uses Production without the approval job",
      "production-deploy.yml#deploy: uses Production without the approval job",
    ]
  )
  assert.deepEqual(
    mutate(
      "production-database.yml",
      "    environment: Production approval\n    runs-on: ubuntu-latest\n    timeout-minutes: 2\n    permissions: {}\n",
      "    environment: Production approval\n    runs-on: ubuntu-latest\n    timeout-minutes: 2\n    permissions: {}\n    steps:\n      - uses: actions/checkout@v4\n"
    ),
    [
      "production-database.yml#approval: approval job must not run code or read secrets",
    ]
  )
  const extra = new Map(workflows)
  extra.set(
    "rogue.yml",
    "name: Rogue\n\non:\n  workflow_dispatch:\n\njobs:\n  write:\n    environment: Production\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n"
  )
  assert.deepEqual(productionGateViolations(extra), [
    "rogue.yml#write: uses Production without the approval job",
  ])
  const dispatchable = new Map(workflows)
  dispatchable.set(
    "production-deploy.yml",
    workflows
      .get("production-deploy.yml")
      .replace(
        "on:\n  workflow_call:\n",
        "on:\n  workflow_dispatch:\n  workflow_call:\n"
      )
  )
  assert.deepEqual(productionGateViolations(dispatchable), [
    "production-deploy.yml#deploy: uses Production without the approval job",
  ])
})

test("the runbook describes one approval on the secret-free environment", () => {
  const runbook = readFileSync("docs/operations/production-runbook.md", "utf8")
  assert.match(runbook, /`Approve production release`/)
  assert.match(runbook, /`Production approval`/)
  assert.match(runbook, /prevent_self_review/)
  assert.doesNotMatch(runbook, /This first approval permits/)
  assert.doesNotMatch(
    runbook,
    /protected\s+environments\s+on\s+both\s+database\s+and\s+application\s+jobs/
  )
})
