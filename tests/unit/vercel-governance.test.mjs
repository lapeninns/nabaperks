import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { evaluateVercelGovernance } from "../../scripts/vercel-governance/checks.mjs"
import { selectVercelProjectMetadata } from "../../scripts/vercel-governance/project-metadata.mjs"

const CONTRACT = JSON.parse(
  readFileSync("config/vercel-governance-contract.json", "utf8")
)
CONTRACT.sourceCrons =
  JSON.parse(readFileSync("vercel.json", "utf8")).crons ?? []

function entries(target) {
  const keys = new Set([
    ...target.requiredKeys,
    ...(target.protectedOptionalKeys ?? []),
  ])
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
      id: CONTRACT.project.id,
      name: CONTRACT.project.name,
      nodeVersion: CONTRACT.project.nodeVersion,
      link: {
        type: CONTRACT.git.type,
        org: CONTRACT.git.org,
        repo: CONTRACT.git.repo,
        productionBranch: CONTRACT.git.productionBranch,
      },
      gitForkProtection: true,
      directoryListing: false,
      protectedSourcemaps: true,
      oidcTokenConfig: { enabled: true, issuerMode: "team" },
      gitProviderOptions: {
        createDeployments: CONTRACT.git.createDeployments,
      },
      customEnvironments: [{ ...CONTRACT.customEnvironment }],
      protectionBypassCount: 1,
      crons: CONTRACT.sourceCrons.map((cron) => ({ ...cron })),
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

test("complete Vercel evidence satisfies every target control", () => {
  const findings = evaluateVercelGovernance(CONTRACT, completeEvidence())

  assert.ok(findings.length >= 15)
  assert.deepEqual(
    findings.filter(({ status }) => status === "FAIL"),
    []
  )
})

test("Vercel evidence fails closed on auto deploys and non-blocking checks", () => {
  const evidence = completeEvidence()
  evidence.project.gitProviderOptions.createDeployments = "enabled"
  evidence.checks[0].blocks = "none"

  const failures = evaluateVercelGovernance(CONTRACT, evidence)
    .filter(({ status }) => status === "FAIL")
    .map(({ control }) => control)

  assert.ok(failures.includes("vercel:git-auto-deploy"))
  assert.ok(
    failures.includes(
      `vercel:deployment-check:${CONTRACT.deploymentChecks[0].name}`
    )
  )
})

test("Vercel evidence reports missing isolated runtime material", () => {
  const evidence = completeEvidence()
  evidence.environments.preview = [
    {
      key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      type: "sensitive",
    },
  ]
  evidence.environments.staging = []

  const failures = evaluateVercelGovernance(CONTRACT, evidence).filter(
    ({ status }) => status === "FAIL"
  )
  const byControl = new Map(
    failures.map(({ control, detail }) => [control, detail])
  )

  assert.doesNotMatch(
    byControl.get("vercel:environment:preview:keys"),
    /NEXT_PUBLIC_APP_URL/
  )
  assert.match(
    byControl.get("vercel:environment:preview:alternative-1"),
    /TWILIO_AUTH_TOKEN/
  )
  assert.match(
    byControl.get("vercel:environment:staging:keys"),
    /NEXT_PUBLIC_APP_URL/
  )
})

test("Vercel evidence detects unsafe server storage and cron drift", () => {
  const evidence = completeEvidence()
  evidence.environments.production.find(
    ({ key }) => key === "STRIPE_SECRET_KEY"
  ).type = "plain"
  evidence.project.crons = evidence.project.crons.slice(1)

  const failures = evaluateVercelGovernance(CONTRACT, evidence)
    .filter(({ status }) => status === "FAIL")
    .map(({ control }) => control)

  assert.ok(failures.includes("vercel:environment:production:protected"))
  assert.ok(failures.includes("vercel:cron-parity"))
})

test("Vercel evidence protects an optional non-production delivery secret", () => {
  const evidence = completeEvidence()
  evidence.environments.preview.find(
    ({ key }) => key === "NON_PRODUCTION_DELIVERY_HMAC_SECRET"
  ).type = "plain"

  const result = evaluateVercelGovernance(CONTRACT, evidence).find(
    ({ control }) => control === "vercel:environment:preview:protected"
  )

  assert.equal(result.status, "FAIL")
  assert.match(result.detail, /NON_PRODUCTION_DELIVERY_HMAC_SECRET/)
})

test("Vercel evidence rejects release credentials in application runtime", () => {
  const evidence = completeEvidence()
  evidence.environments.production.push({
    key: "SUPABASE_DB_PASSWORD",
    type: "sensitive",
  })

  const result = evaluateVercelGovernance(CONTRACT, evidence).find(
    ({ control }) => control === "vercel:environment:production:scope"
  )

  assert.equal(result.status, "FAIL")
  assert.match(result.detail, /SUPABASE_DB_PASSWORD/)
})

test("Vercel evidence requires production Sentry release and source-map settings", () => {
  const evidence = completeEvidence()
  evidence.environments.production = evidence.environments.production.filter(
    ({ key }) => !key.includes("SENTRY")
  )

  const result = evaluateVercelGovernance(CONTRACT, evidence).find(
    ({ control }) => control === "vercel:environment:production:keys"
  )

  assert.equal(result.status, "FAIL")
  assert.match(result.detail, /NEXT_PUBLIC_SENTRY_DSN/)
  assert.match(result.detail, /SENTRY_AUTH_TOKEN/)
  assert.match(result.detail, /SENTRY_ORG/)
  assert.match(result.detail, /SENTRY_PROJECT/)
})

test("project evidence drops every environment and deployment value", () => {
  const secretSentinel = "must-not-survive-selection"
  const selected = selectVercelProjectMetadata({
    ...completeEvidence().project,
    env: [{ key: "SECRET", value: secretSentinel }],
    latestDeployments: [{ meta: { secret: secretSentinel } }],
    targets: { production: { value: secretSentinel } },
    protectionBypass: { bypass_id: { value: secretSentinel } },
    crons: {
      definitions: CONTRACT.sourceCrons,
    },
  })

  assert.doesNotMatch(JSON.stringify(selected), new RegExp(secretSentinel))
  assert.equal(selected.protectionBypassCount, 1)
  assert.deepEqual(selected.crons, CONTRACT.sourceCrons)
})
