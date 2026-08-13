import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

const actionInventory = (workflow) =>
  [...workflow.matchAll(/^\s+- name: (.+)$/gm)].map((match) => match[1])

const jobBlock = (workflow, name) => {
  const match = workflow.match(
    new RegExp(
      `^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][\\w-]+:|(?![\\s\\S]))`,
      "m"
    )
  )

  assert.ok(match, `expected ${name} job to exist`)
  return match[0]
}

test("Given the current SLO workflow When actions are inventoried Then the legitimate read-only reporting path remains explicit", () => {
  const workflow = read(".github/workflows/slo-report.yml")

  const inventory = actionInventory(workflow)
  assert.deepEqual(
    inventory.filter((name) =>
      [
        "Check out SLO contract",
        "Calculate the rolling SLO",
        "Classify the SLO result",
        "Publish the evidence artifact",
        "Add the report to the workflow summary",
      ].includes(name)
    ),
    [
      "Check out SLO contract",
      "Calculate the rolling SLO",
      "Classify the SLO result",
      "Publish the evidence artifact",
      "Add the report to the workflow summary",
    ]
  )
  assert.match(workflow, /actions: read/)
  assert.match(workflow, /contents: read/)
  assert.match(workflow, /persist-credentials: false/)
})

test("Given the current recovery workflow When actions are inventoried Then verification uses read-only provider and database boundaries", () => {
  const workflow = read(".github/workflows/recovery-drill.yml")

  const inventory = actionInventory(workflow)
  assert.deepEqual(
    inventory.filter((name) =>
      [
        "Check out main",
        "Verify the dispatched main revision",
        "Set up project",
        "Capture provider backup and project evidence",
        "Verify the restored ledger, RLS and core read path",
      ].includes(name)
    ),
    [
      "Check out main",
      "Verify the dispatched main revision",
      "Set up project",
      "Capture provider backup and project evidence",
      "Verify the restored ledger, RLS and core read path",
    ]
  )
  assert.match(workflow, /permissions:\n  actions: read\n  contents: read/)
  assert.match(workflow, /supabase backups list/)
  assert.match(workflow, /supabase projects list/)
  assert.doesNotMatch(
    workflow,
    /supabase (?:db push|projects delete|backup restore)/
  )
})

test("Given scheduled or observational SLO runs When the workflow executes Then their path has zero mutation permissions and cannot certify recovery", () => {
  const workflow = read(".github/workflows/slo-report.yml")

  assert.match(
    workflow,
    /observation:\n[\s\S]*?permissions:\n\s+actions: read\n\s+contents: read/
  )
  assert.match(workflow, /certification: "observation-only"/)
  assert.doesNotMatch(
    workflow.match(/observation:\n([\s\S]*?)(?=\n  [a-z][\w-]+:\n|$)/)?.[1] ??
      "",
    /issues: write|notify-production-alert|issues\.(?:create|update|createComment)/
  )
})

test("Given paging is a mutation When paging or resolution is requested Then explicit authorisation, ordering, and replay guards apply", () => {
  const workflow = read(".github/workflows/slo-report.yml")

  assert.match(workflow, /effect:\n\s+description: Explicit mutation effect/)
  assert.match(workflow, /authorisation_receipt_sha256:/)
  assert.match(workflow, /evidence_run_id:/)
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/)
  assert.match(workflow, /GITHUB_RUN_ATTEMPT/)
  assert.match(
    workflow,
    /EVIDENCE_RUN_ID.*GITHUB_RUN_ID|GITHUB_RUN_ID.*EVIDENCE_RUN_ID/s
  )
  assert.match(workflow, /authorisation-receipt:/)
  assert.match(workflow, /duplicate authorisation receipt/)
  assert.match(workflow, /actions\/runs\/\$EVIDENCE_RUN_ID\/artifacts/)
})

test("Given an effect references an observation When its receipt is stale, wrong-revision, unsuccessful, or state-mismatched Then authorisation rejects it and uses only the referenced state", () => {
  const workflow = read(".github/workflows/slo-report.yml")
  const authorisation = jobBlock(workflow, "authorise-effect")
  const effect = jobBlock(workflow, "apply-effect")

  assert.doesNotMatch(authorisation, /needs: observation/)
  assert.doesNotMatch(
    authorisation,
    /OBSERVED_STATE|needs\.observation\.outputs\.state/
  )
  assert.match(authorisation, /EVIDENCE_MAX_AGE_SECONDS: 86400/)
  assert.match(authorisation, /actions\/runs\/\$EVIDENCE_RUN_ID/)
  assert.match(authorisation, /actions\/workflows\/slo-report\.yml/)
  assert.match(authorisation, /actions\/artifacts\/\$artifact_id\/zip/)
  assert.match(authorisation, /production-slo-report\.json/)
  assert.match(authorisation, /nabaperks\.production-slo-observation\.v1/)
  assert.match(authorisation, /identity\.repository/)
  assert.match(authorisation, /identity\.workflowPath/)
  assert.match(authorisation, /identity\.sourceSha == \$run\.head_sha/)
  assert.match(authorisation, /identity\.runId == \$expectedRunId/)
  assert.match(authorisation, /identity\.state == \.state/)
  assert.match(authorisation, /\.status == "completed"/)
  assert.match(authorisation, /\.conclusion == "success"/)
  assert.match(authorisation, /fromdateiso8601/)
  assert.match(
    authorisation,
    /state: \$\{\{ steps\.receipt\.outputs\.state \}\}/
  )
  assert.match(effect, /needs\.authorise-effect\.outputs\.state/)
  assert.doesNotMatch(effect, /needs\.observation\.outputs\.state/)
})

test("Given a recovery drill When evidence is submitted Then restore and cleanup have independent receipt schemas and jobs", () => {
  const workflow = read(".github/workflows/recovery-drill.yml")

  assert.match(workflow, /phase:\n\s+description: Evidence phase/)
  assert.match(workflow, /restore_authorisation_receipt_sha256:/)
  assert.match(workflow, /restore_provider_receipt_sha256:/)
  assert.match(workflow, /cleanup_authorisation_receipt_sha256:/)
  assert.match(workflow, /cleanup_provider_receipt_sha256:/)
  assert.match(workflow, /verify-restore:/)
  assert.match(workflow, /verify-cleanup:/)
  assert.match(workflow, /inputs\.phase == 'restore-verification'/)
  assert.match(workflow, /inputs\.phase == 'cleanup-verification'/)
  assert.match(workflow, /project_absent/)
  assert.match(workflow, /actions\/runs\/\$PREVIOUS_EVIDENCE_RUN_ID\/artifacts/)
  assert.match(workflow, /independent restore receipt is missing or ambiguous/)
})

test("Given duplicate, stale, or interrupted recovery evidence When certification is evaluated Then it fails closed", () => {
  const workflow = read(".github/workflows/recovery-drill.yml")

  assert.match(workflow, /GITHUB_RUN_ATTEMPT/)
  assert.match(workflow, /evidence_sequence:/)
  assert.match(workflow, /previous_evidence_run_id:/)
  assert.match(workflow, /GITHUB_RUN_ID/)
  assert.match(workflow, /duplicate receipt/)
  assert.match(workflow, /cancelled\(\)|failure\(\)/)
  assert.match(workflow, /certification-status: incomplete/)
})

test("Given simultaneous recovery reservations for different projects When they present one provider receipt Then a global preflight mutex serialises the repository-wide check and reserve", () => {
  const workflow = read(".github/workflows/recovery-drill.yml")
  const preflight = jobBlock(workflow, "preflight")

  assert.match(
    preflight,
    /concurrency:\n\s+group: recovery-receipt-reservation\n\s+cancel-in-progress: false/
  )
  assert.doesNotMatch(
    preflight,
    /group:\s*recovery-receipt-reservation.*restore_project_ref/
  )
  assert.match(preflight, /Reject a duplicate receipt artifact/)
  assert.match(preflight, /Reserve the provider receipt/)
})
