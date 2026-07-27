import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildVercelGovernanceRemediationPlan } from "../../scripts/vercel-governance/remediation-plan.mjs"

const CONTRACT = JSON.parse(
  readFileSync("config/vercel-governance-contract.json", "utf8")
)

function entries(target) {
  const keys = new Set(target.requiredKeys)
  for (const alternatives of target.requiredAnyOf ?? []) {
    for (const key of alternatives[0]) keys.add(key)
  }
  return [...keys].map((key) => ({
    key,
    type: key.startsWith("NEXT_PUBLIC_") ? "sensitive" : "encrypted",
  }))
}

function deploymentCheck(target) {
  return {
    name: target.name,
    requires: target.requires,
    blocks: target.blocks,
    targets: [...target.targets],
    source: {
      kind: "git-provider",
      provider: "github",
      externalCheckName: target.externalCheckName,
    },
  }
}

function completeEvidence() {
  return {
    project: {
      gitProviderOptions: {
        createDeployments: CONTRACT.git.createDeployments,
      },
    },
    checks: CONTRACT.deploymentChecks.map(deploymentCheck),
    environments: Object.fromEntries(
      Object.entries(CONTRACT.environments).map(([name, target]) => [
        name,
        entries(target),
      ])
    ),
  }
}

test("compliant Vercel evidence produces an empty plan", () => {
  const plan = buildVercelGovernanceRemediationPlan(
    CONTRACT,
    completeEvidence()
  )

  assert.equal(plan.mode, "plan-only")
  assert.equal(plan.containsProviderValues, false)
  assert.equal(plan.summary.operationCount, 0)
  assert.deepEqual(plan.operations, [])
})

test("plan names missing protected material without retaining provider values", () => {
  const evidence = completeEvidence()
  const secretSentinel = "must-not-appear-in-remediation-plan"
  evidence.environments.staging = [
    {
      key: "NEXT_PUBLIC_APP_URL",
      type: "sensitive",
      value: secretSentinel,
    },
  ]

  const plan = buildVercelGovernanceRemediationPlan(CONTRACT, evidence)
  const operation = plan.operations[0]

  assert.equal(operation.kind, "provision-protected-environment-values")
  assert.equal(operation.status, "requires-protected-values")
  assert.ok(operation.environments[0].missingKeys.includes("STRIPE_SECRET_KEY"))
  assert.deepEqual(operation.environments[0].missingAlternatives, [
    [["TWILIO_AUTH_TOKEN"], ["TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"]],
  ])
  assert.doesNotMatch(JSON.stringify(plan), new RegExp(secretSentinel))
})

test("plan uses exact blocking GitHub check requests", () => {
  const evidence = completeEvidence()
  evidence.checks = []

  const plan = buildVercelGovernanceRemediationPlan(CONTRACT, evidence)
  const checkOperations = plan.operations.filter(
    ({ kind }) => kind === "create-deployment-check"
  )

  assert.equal(checkOperations.length, CONTRACT.deploymentChecks.length)
  assert.deepEqual(checkOperations[0].request, {
    method: "POST",
    path: `/v2/projects/${CONTRACT.project.id}/checks`,
    body: {
      name: "Release gate",
      requires: "build-ready",
      blocks: "deployment-alias",
      targets: ["production"],
      source: {
        kind: "git-provider",
        provider: "github",
        externalCheckName: "Release gate",
      },
    },
  })
})

test("plan updates an identified deployment check instead of duplicating it", () => {
  const evidence = completeEvidence()
  evidence.checks[0].id = "check_release_gate"
  evidence.checks[0].blocks = "none"

  const plan = buildVercelGovernanceRemediationPlan(CONTRACT, evidence)
  const operation = plan.operations[0]

  assert.equal(operation.kind, "update-deployment-check")
  assert.equal(operation.request.method, "PATCH")
  assert.equal(
    operation.request.path,
    `/v2/projects/${CONTRACT.project.id}/checks/check_release_gate`
  )
  assert.equal(operation.request.body.blocks, "deployment-alias")
})

test("Git auto deploy is always last and deferred behind release prerequisites", () => {
  const evidence = completeEvidence()
  evidence.project.gitProviderOptions.createDeployments = "enabled"
  evidence.checks = []
  evidence.environments.production.push({
    key: "SUPABASE_DB_PASSWORD",
    type: "sensitive",
  })

  const plan = buildVercelGovernanceRemediationPlan(CONTRACT, evidence)
  const operation = plan.operations.at(-1)

  assert.equal(operation.kind, "disable-git-auto-deploy")
  assert.equal(operation.status, "deferred-until-prerequisites-pass")
  assert.deepEqual(operation.request, {
    method: "PATCH",
    path: `/v9/projects/${CONTRACT.project.id}`,
    body: {
      gitProviderOptions: {
        createDeployments: "disabled",
      },
    },
  })
  assert.ok(
    operation.prerequisites.includes("remove-forbidden-runtime-variables")
  )
  assert.ok(operation.prerequisites.includes("create-deployment-check"))
})

test("Git auto deploy can be approved only after prerequisites are live", () => {
  const evidence = completeEvidence()
  evidence.project.gitProviderOptions.createDeployments = "enabled"

  const plan = buildVercelGovernanceRemediationPlan(CONTRACT, evidence)

  assert.equal(plan.operations.length, 1)
  assert.equal(plan.operations[0].kind, "disable-git-auto-deploy")
  assert.equal(plan.operations[0].status, "requires-production-approval")
  assert.deepEqual(plan.operations[0].prerequisites, [])
})
