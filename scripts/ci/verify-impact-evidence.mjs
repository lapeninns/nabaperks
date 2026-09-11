import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import assert from "node:assert/strict"
import { planChecks } from "./plan-checks.mjs"
import {
  ALL_WORKLOADS,
  expectedIdentity,
  validatePlan,
} from "./impact-plan-contract.mjs"

// Formats validated job states only; the CLI additionally rebinds the plan to Git.
export function summarizeImpactEvidence(evidence, identity) {
  assert.ok(
    evidence && typeof evidence === "object" && !Array.isArray(evidence),
    "Missing job evidence"
  )
  const expected = [
    "selection",
    ...ALL_WORKLOADS,
    "selection-comparison",
  ].sort()
  assert.deepEqual(
    Object.keys(evidence).sort(),
    expected,
    "Unexpected or missing CI jobs"
  )
  assert.equal(
    evidence.selection?.result,
    "success",
    "Selection did not succeed"
  )
  const plan = validatePlan(
    JSON.parse(evidence.selection.outputs?.plan ?? "null"),
    identity
  )
  const rows = []
  for (const name of ALL_WORKLOADS) {
    const required =
      plan.required.includes(name) ||
      (plan.comparisonRequired &&
        ["documentation", "targeted-browser", "targeted-visual"].includes(name))
    const result = evidence[name]?.result
    assert.equal(
      result,
      required ? "success" : "skipped",
      `${name}: ${required ? "successful execution required" : "must be explicitly not required"}`
    )
    rows.push(`${name}: ${required ? "passed" : "not required (not executed)"}`)
  }
  assert.equal(
    evidence["selection-comparison"]?.result,
    plan.comparisonRequired ? "success" : "skipped",
    "Selection comparison is missing or unexpected"
  )
  return `Profile: ${plan.profile}\n${plan.reason}\n${rows.join("\n")}`
}

export function verifyImpactEvidence(
  evidence,
  identity,
  { cwd, headRepository = process.env.CI_HEAD_REPOSITORY } = {}
) {
  const summary = summarizeImpactEvidence(evidence, identity)
  const actual = planChecks(
    {
      GITHUB_REPOSITORY: identity.repository,
      GITHUB_EVENT_NAME: identity.event,
      CI_BASE_SHA: identity.baseSha,
      CI_HEAD_SHA: identity.headSha,
      GITHUB_SHA: identity.candidateSha,
      GITHUB_REF: identity.event === "push" ? "refs/heads/main" : undefined,
      CI_HEAD_REPOSITORY: headRepository,
    },
    { cwd }
  )
  assert.deepEqual(
    JSON.parse(evidence.selection.outputs.plan),
    actual,
    "Selection plan differs from the reviewed immutable Git classification"
  )
  return summary
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const summary = verifyImpactEvidence(
      JSON.parse(process.env.CI_REQUIRED_EVIDENCE ?? "null"),
      expectedIdentity(process.env)
    )
    console.log(summary)
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Required CI evidence\n\n\`\`\`text\n${summary}\n\`\`\`\n`
      )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
