import { readFileSync } from "node:fs"

import { evaluateVercelGovernance } from "./vercel-governance/checks.mjs"
import { collectVercelGovernanceEvidence } from "./vercel-governance/evidence.mjs"

const CONTRACT_PATH = "config/vercel-governance-contract.json"
const VERCEL_CONFIG_PATH = "vercel.json"

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
