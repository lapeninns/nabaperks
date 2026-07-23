import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

import {
  detectDuplicateVersions,
  listLocalMigrationVersions,
  parseRemoteMigrationVersions,
  runSupabaseMigrationList,
} from "./check-supabase-migrations.mjs"
import { evaluateSupabaseGovernance } from "./supabase-governance/checks.mjs"
import {
  selectSupabaseBackupsMetadata,
  selectSupabaseProjectsMetadata,
} from "./supabase-governance/metadata.mjs"

const CONTRACT_PATH = "config/supabase-governance-contract.json"

function supabaseJson(args) {
  const result = spawnSync("supabase", [...args, "--output", "json"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `Supabase metadata read failed for ${args.join(" ")} (exit ${result.status ?? 1})`
    )
  }
  return JSON.parse(result.stdout)
}

export function collectSupabaseGovernanceEvidence(contract) {
  const projectDir = process.cwd()
  const migrationResult = runSupabaseMigrationList(projectDir, process.env)
  if (migrationResult.status !== 0) {
    throw new Error(
      `Supabase migration metadata read failed (exit ${migrationResult.status})`
    )
  }

  const localVersions = listLocalMigrationVersions(projectDir)
  return {
    observedAt: new Date().toISOString(),
    projects: selectSupabaseProjectsMetadata(
      supabaseJson(["projects", "list"])
    ),
    backups: selectSupabaseBackupsMetadata(
      supabaseJson([
        "backups",
        "list",
        "--project-ref",
        contract.productionProject.ref,
      ])
    ),
    migrations: {
      localVersions,
      remoteVersions: parseRemoteMigrationVersions(migrationResult.output),
      duplicateLocalVersions: detectDuplicateVersions(localVersions),
    },
  }
}

export function printSupabaseFindings(findings) {
  for (const result of findings) {
    console.log(
      `${result.status.padEnd(4)} ${result.control}: ${result.detail}`
    )
  }
}

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"))
const evidencePath = process.env.SUPABASE_GOVERNANCE_EVIDENCE_FILE
const evidence = evidencePath
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : collectSupabaseGovernanceEvidence(contract)
const findings = evaluateSupabaseGovernance(contract, evidence)

printSupabaseFindings(findings)

const failures = findings.filter(({ status }) => status === "FAIL")
const passes = findings.length - failures.length
if (failures.length > 0) {
  console.error(
    `\nSupabase governance is not ready: ${passes} passed; ${failures.length} control(s) need evidence.`
  )
  process.exit(1)
}

console.log("\nSupabase governance controls passed.")
