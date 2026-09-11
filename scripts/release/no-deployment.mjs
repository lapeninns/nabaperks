import assert from "node:assert/strict"
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { FULL_SHA, git } from "../ci/impact-git.mjs"
import { documentationDifference } from "../ci/impact-documentation.mjs"
import { validateProductionCandidate } from "./candidate.mjs"

export function createNoDeployment(baseline, expected, { cwd } = {}) {
  assert.equal(expected.repository, "lapeninns/nabaperks")
  assert.match(expected.runId ?? "", /^[1-9]\d*$/)
  assert.ok(Number.isSafeInteger(expected.attempt) && expected.attempt > 0)
  assert.match(expected.candidateRevision ?? "", FULL_SHA)
  assert.equal(baseline.schema, "nabaperks.production-baseline.v1")
  const identity = validateProductionCandidate(
    {
      id: baseline.deploymentId,
      projectId: baseline.projectId,
      ownerId: baseline.teamId,
      url: new URL(baseline.url).hostname,
      target: baseline.target,
      readyState: "READY",
      meta: { githubCommitSha: baseline.revision },
    },
    {
      revision: baseline.revision,
      projectId: expected.projectId,
      teamId: expected.teamId,
      url: baseline.url,
    }
  )
  assert.ok(
    Number.isFinite(Date.parse(baseline.observedAt)),
    "Baseline observation required"
  )
  const difference = documentationDifference(
    baseline.revision,
    expected.candidateRevision,
    { cwd }
  )
  if (!difference) return null
  return {
    schema: "nabaperks.no-deployment.v1",
    outcome: "not-required",
    repository: expected.repository,
    releaseRunId: expected.runId,
    releaseRunAttempt: expected.attempt,
    candidateRevision: expected.candidateRevision,
    baseline: {
      schema: baseline.schema,
      ...identity,
      observedAt: baseline.observedAt,
    },
    ...difference,
  }
}

export function validateNoDeployment(artifact, expected, { cwd } = {}) {
  assert.equal(artifact.schema, "nabaperks.no-deployment.v1")
  assert.equal(artifact.outcome, "not-required")
  assert.equal(artifact.repository, expected.repository)
  assert.equal(artifact.releaseRunId, expected.runId)
  assert.equal(artifact.releaseRunAttempt, expected.attempt)
  assert.match(expected.candidateRevision ?? "", FULL_SHA)
  assert.equal(
    artifact.candidateRevision,
    expected.candidateRevision,
    "No-deployment candidate differs from the originating release revision"
  )
  const verified = createNoDeployment(artifact.baseline, expected, { cwd })
  assert.ok(
    verified,
    "Candidate contains application changes or uncertain impact"
  )
  assert.deepEqual(
    artifact,
    verified,
    "No-deployment evidence differs from the actual Git comparison"
  )
  return {
    ...artifact.baseline,
    outcome: "not-required",
    candidateRevision: artifact.candidateRevision,
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(process.argv.length, 4)
    assert.equal(
      git(["rev-parse", "HEAD"]).trim(),
      process.env.EXPECTED_REVISION
    )
    const baseline = JSON.parse(readFileSync(process.argv[2], "utf8"))
    // An explicit manual promotion retains its requested redeployment semantics.
    const artifact =
      process.env.GITHUB_EVENT_NAME === "workflow_run"
        ? createNoDeployment(baseline, {
            repository: process.env.GITHUB_REPOSITORY,
            runId: process.env.RELEASE_RUN_ID,
            attempt: Number(process.env.RELEASE_RUN_ATTEMPT),
            candidateRevision: process.env.EXPECTED_REVISION,
            projectId: baseline.projectId,
            teamId: baseline.teamId,
          })
        : null
    if (artifact)
      writeFileSync(process.argv[3], JSON.stringify(artifact) + "\n", {
        flag: "wx",
        mode: 0o600,
      })
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `application_required=${!artifact}\n`
    )
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        artifact
          ? `### Application deployment not required\n\nOnly internal documentation differs from authenticated production revision \`${baseline.revision}\`. Candidate \`${artifact.candidateRevision}\` was not deployed. Database promotion and application deployment did not run.\n`
          : "### Application release required\n\nThe complete candidate is not a qualified documentation-only change from production. All application release stages remain required.\n"
      )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
