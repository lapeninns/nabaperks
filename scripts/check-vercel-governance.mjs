import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

import { evaluateVercelGovernance } from "./vercel-governance/checks.mjs"
import {
  selectVercelProjectMetadata,
  selectDeploymentMetadata,
} from "./vercel-governance/project-metadata.mjs"

const CONTRACT_PATH = "config/vercel-governance-contract.json"
const VERCEL_CONFIG_PATH = "vercel.json"

function vercelJson(args) {
  const result = spawnSync("vercel", [...args, "--no-color"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `Vercel metadata read failed for ${args.join(" ")}: ${result.stderr.trim()}`
    )
  }
  return JSON.parse(result.stdout)
}

function collectProjectMetadata(contract) {
  const raw = vercelJson([
    "api",
    `/v9/projects/${contract.project.id}`,
    "--scope",
    contract.scope,
    "--raw",
  ])

  return selectVercelProjectMetadata(raw)
}

function collectDeploymentObservation(contract) {
  const checkedAt = new Date().toISOString()
  const since = new Date(
    Date.parse(checkedAt) - 24 * 60 * 60 * 1000
  ).toISOString()
  const deployments = []
  const seen = new Set()
  let until
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({
      projectId: contract.project.id,
      limit: "100",
      since: String(Date.parse(since)),
    })
    if (until) params.set("until", String(until))
    const result = vercelJson([
      "api",
      `/v6/deployments?${params}`,
      "--scope",
      contract.scope,
      "--raw",
    ])
    for (const raw of result.deployments ?? []) {
      const entry = selectDeploymentMetadata(raw)
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        deployments.push(entry)
      }
    }
    if (!result.pagination?.next)
      return { checkedAt, since, complete: true, deployments }
    if (until && result.pagination.next >= until)
      throw new Error("Deployment pagination did not advance")
    until = result.pagination.next
  }
  throw new Error("Deployment observation exceeded its pagination bound")
}

export function collectVercelGovernanceEvidence(contract) {
  const scopeArgs = ["--scope", contract.scope, "--format", "json"]
  const checks = vercelJson([
    "project",
    "checks",
    contract.project.name,
    ...scopeArgs,
  ])
  const environments = {}

  for (const name of Object.keys(contract.environments)) {
    const result = vercelJson([
      "env",
      "ls",
      name,
      "--project",
      contract.project.name,
      ...scopeArgs,
    ])
    environments[name] = (result.envs ?? []).map(
      ({ key, type, target, gitBranch, configurationId }) => ({
        key,
        type,
        target,
        gitBranch,
        configurationId,
      })
    )
  }

  return {
    project: collectProjectMetadata(contract),
    deploymentObservation: collectDeploymentObservation(contract),
    checks: checks.checks ?? [],
    environments,
  }
}

export function printVercelFindings(findings) {
  for (const result of findings) {
    console.log(
      `${result.status.padEnd(4)} ${result.control}: ${result.detail}`
    )
  }
}

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"))
const vercelConfig = JSON.parse(readFileSync(VERCEL_CONFIG_PATH, "utf8"))
contract.sourceCrons = vercelConfig.crons ?? []

const evidencePath = process.env.VERCEL_GOVERNANCE_EVIDENCE_FILE
const evidence = evidencePath
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : collectVercelGovernanceEvidence(contract)
evidence.sourceGit = vercelConfig.git ?? {}
const findings = evaluateVercelGovernance(contract, evidence)

printVercelFindings(findings)

const failures = findings.filter(({ status }) => status === "FAIL")
const passes = findings.length - failures.length
if (failures.length > 0) {
  console.error(
    `\nVercel governance is not ready: ${passes} passed; ${failures.length} control(s) need evidence.`
  )
  process.exit(1)
}

console.log("\nVercel governance controls passed.")
