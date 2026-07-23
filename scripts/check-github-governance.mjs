import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

import { evaluateGitHubGovernance } from "./github-governance/checks.mjs"

const CONTRACT_PATH = "config/github-governance-contract.json"
const CODEOWNERS_PATH = ".github/CODEOWNERS"

function ghJson(endpoint) {
  const result = spawnSync("gh", ["api", endpoint], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `GitHub metadata read failed for ${endpoint}: ${result.stderr.trim()}`
    )
  }
  return JSON.parse(result.stdout)
}

function namesFrom(endpoint, property) {
  return (ghJson(endpoint)[property] ?? []).map(({ name }) => name)
}

function variablesFrom(endpoint) {
  return Object.fromEntries(
    (ghJson(endpoint).variables ?? []).map(({ name, value }) => [name, value])
  )
}

export function collectGitHubGovernanceEvidence(contract) {
  const repository = contract.repository
  const rulesets = ghJson(`repos/${repository}/rulesets?per_page=100`)
  const summary = rulesets.find(({ name }) => name === contract.ruleset.name)
  const environments = {}

  for (const name of Object.keys(contract.environments)) {
    const encoded = encodeURIComponent(name)
    const root = `repos/${repository}/environments/${encoded}`
    environments[name] = {
      configuration: ghJson(root),
      secretNames: namesFrom(`${root}/secrets?per_page=100`, "secrets"),
      variables: variablesFrom(`${root}/variables?per_page=100`),
    }
  }

  return {
    collaborators: ghJson(
      `repos/${repository}/collaborators?affiliation=all&per_page=100`
    ),
    codeowners: readFileSync(CODEOWNERS_PATH, "utf8"),
    environments,
    repositorySecretNames: namesFrom(
      `repos/${repository}/actions/secrets?per_page=100`,
      "secrets"
    ),
    ruleset: summary
      ? ghJson(`repos/${repository}/rulesets/${summary.id}`)
      : null,
  }
}

export function printGovernanceFindings(findings) {
  for (const result of findings) {
    console.log(
      `${result.status.padEnd(4)} ${result.control}: ${result.detail}`
    )
  }
}

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"))
const evidencePath = process.env.GITHUB_GOVERNANCE_EVIDENCE_FILE
const evidence = evidencePath
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : collectGitHubGovernanceEvidence(contract)
const findings = evaluateGitHubGovernance(contract, evidence)

printGovernanceFindings(findings)

const failures = findings.filter(({ status }) => status === "FAIL")
if (failures.length > 0) {
  console.error(
    `\nGitHub governance is not ready: ${failures.length} control(s) need evidence.`
  )
  process.exit(1)
}

console.log("\nGitHub governance controls passed.")
