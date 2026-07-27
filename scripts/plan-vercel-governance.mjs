import { readFileSync } from "node:fs"

import { collectVercelGovernanceEvidence } from "./vercel-governance/evidence.mjs"
import { buildVercelGovernanceRemediationPlan } from "./vercel-governance/remediation-plan.mjs"

const CONTRACT_PATH = "config/vercel-governance-contract.json"
const VERCEL_CONFIG_PATH = "vercel.json"

if (process.argv.includes("--apply")) {
  throw new Error(
    "This command is plan-only. Apply provider changes through an explicitly approved operator workflow."
  )
}

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"))
const vercelConfig = JSON.parse(readFileSync(VERCEL_CONFIG_PATH, "utf8"))
contract.sourceCrons = vercelConfig.crons ?? []

const evidencePath = process.env.VERCEL_GOVERNANCE_EVIDENCE_FILE
const evidence = evidencePath
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : collectVercelGovernanceEvidence(contract)

console.log(
  JSON.stringify(
    buildVercelGovernanceRemediationPlan(contract, evidence),
    null,
    2
  )
)
