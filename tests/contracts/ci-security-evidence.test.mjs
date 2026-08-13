import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/nightly.yml",
]

test("Given workflow evidence When a lane ends Then exact-revision receipts and reports are retained", () => {
  for (const path of WORKFLOWS) {
    const workflow = readFileSync(path, "utf8")
    assert.doesNotMatch(workflow, /if: \$\{\{ !cancelled\(\)/)
    assert.match(workflow, /if: \$\{\{ always\(\) \}\}/)
    for (const field of [
      "run_id",
      "run_attempt",
      "workflow",
      "workflow_ref",
      "job",
      "sha",
    ]) {
      assert.match(workflow, new RegExp(`github\\.${field}`))
    }
    assert.match(
      workflow,
      /\{run: \$run_id,[\s\S]*workflow: \$workflow,[\s\S]*job: \$job,[\s\S]*commit: \$commit_sha,[\s\S]*artifact: \$artifact/
    )
    assert.match(workflow, /retention-days: 30/)
  }
  for (const path of [WORKFLOWS[0], WORKFLOWS[3]]) {
    const workflow = readFileSync(path, "utf8")
    assert.match(workflow, /zap-report/)
    for (const report of ["html", "json", "md"]) {
      assert.match(workflow, new RegExp(`report_${report}\\.${report}`))
    }
  }
})

test("Given nightly QA When race configuration is absent Then the prerequisite cannot silently skip", () => {
  const nightly = readFileSync(WORKFLOWS[3], "utf8")
  const loadRace = nightly.slice(
    nightly.indexOf("\n  load-race:"),
    nightly.indexOf("\n  zap-full:")
  )

  assert.doesNotMatch(loadRace, /\n    if:/)
  assert.match(loadRace, /test -n "\$STAMP_RACE_URL"/)
  assert.match(loadRace, /test -n "\$REDEEM_RACE_URL"/)
  assert.match(nightly, /nightly-gate:[\s\S]*needs:[\s\S]*- load-race/)
  assert.match(nightly, /nightly-gate:[\s\S]*needs\['load-race'\]\.result/)
})

test("Given governed workflows When external actions execute Then each action is pinned to a full SHA", () => {
  for (const path of WORKFLOWS) {
    const workflow = readFileSync(path, "utf8")
    const actions = [...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)]
      .map((match) => match[1])
      .filter((action) => !action.startsWith("./"))

    assert.ok(actions.length > 0)
    for (const action of actions) assert.match(action, /^[^@]+@[a-f0-9]{40}$/)
  }
})
