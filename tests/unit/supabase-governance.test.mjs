import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { evaluateSupabaseGovernance } from "../../scripts/supabase-governance/checks.mjs"
import {
  selectSupabaseBackupsMetadata,
  selectSupabaseProjectsMetadata,
} from "../../scripts/supabase-governance/metadata.mjs"

const CONTRACT = JSON.parse(
  readFileSync("config/supabase-governance-contract.json", "utf8")
)
const OBSERVED_AT = "2026-07-23T12:00:00.000Z"
const MIGRATIONS = ["20260722100400", "20260722100500", "20260723113000"]

function backups() {
  return Array.from(
    { length: CONTRACT.backups.minimumCompletedPhysicalBackups },
    (_, index) => ({
      id: index + 1,
      insertedAt: new Date(
        Date.parse("2026-07-23T07:00:00.000Z") - index * 24 * 60 * 60 * 1000
      ).toISOString(),
      physical: true,
      status: "COMPLETED",
    })
  )
}

function completeEvidence() {
  return {
    observedAt: OBSERVED_AT,
    projects: [
      {
        ref: CONTRACT.productionProject.ref,
        name: CONTRACT.productionProject.name,
        organizationId: CONTRACT.productionProject.organizationId,
        region: CONTRACT.productionProject.region,
        status: CONTRACT.productionProject.status,
        linked: true,
        postgresEngine: CONTRACT.productionProject.postgresEngine,
      },
    ],
    backups: {
      region: CONTRACT.backups.region,
      walgEnabled: true,
      pitrEnabled: true,
      backups: backups(),
    },
    migrations: {
      localVersions: [...MIGRATIONS],
      remoteVersions: [...MIGRATIONS],
      duplicateLocalVersions: [],
    },
  }
}

test("complete Supabase evidence satisfies every target control", () => {
  const findings = evaluateSupabaseGovernance(CONTRACT, completeEvidence())

  assert.equal(findings.length, 10)
  assert.deepEqual(
    findings.filter(({ status }) => status === "FAIL"),
    []
  )
})

test("Supabase evidence fails closed on project identity, health and link", () => {
  const evidence = completeEvidence()
  evidence.projects[0].region = "us-east-1"
  evidence.projects[0].status = "INACTIVE"
  evidence.projects[0].linked = false

  const failures = evaluateSupabaseGovernance(CONTRACT, evidence)
    .filter(({ status }) => status === "FAIL")
    .map(({ control }) => control)

  assert.ok(failures.includes("supabase:production-identity"))
  assert.ok(failures.includes("supabase:production-health"))
  assert.ok(failures.includes("supabase:production-link"))
})

test("Supabase evidence reports exact migration-ledger drift", () => {
  const evidence = completeEvidence()
  evidence.migrations.remoteVersions = ["20260722100400", "20260721100000"]
  evidence.migrations.duplicateLocalVersions = ["20260723113000"]

  const result = evaluateSupabaseGovernance(CONTRACT, evidence).find(
    ({ control }) => control === "supabase:migration-ledger"
  )

  assert.equal(result.status, "FAIL")
  assert.match(result.detail, /duplicate local versions: 20260723113000/)
  assert.match(
    result.detail,
    /missing on remote: 20260722100500, 20260723113000/
  )
  assert.match(result.detail, /remote-only: 20260721100000/)
})

test("Supabase evidence rejects stale, discontinuous or failed backups and missing PITR", () => {
  const evidence = completeEvidence()
  evidence.backups.pitrEnabled = false
  evidence.backups.backups[0].insertedAt = "2026-07-20T00:00:00.000Z"
  evidence.backups.backups[1].status = "FAILED"

  const failures = evaluateSupabaseGovernance(CONTRACT, evidence)
    .filter(({ status }) => status === "FAIL")
    .map(({ control }) => control)

  assert.ok(failures.includes("supabase:pitr"))
  assert.ok(failures.includes("supabase:backup-freshness"))
  assert.ok(failures.includes("supabase:backup-continuity"))
  assert.ok(failures.includes("supabase:backup-status"))
})

test("Supabase metadata selection drops provider values outside the contract", () => {
  const secretSentinel = "must-not-survive-selection"
  const projects = selectSupabaseProjectsMetadata([
    {
      ref: "project-ref",
      name: "project",
      organization_id: "organisation",
      region: "eu-west-2",
      status: "ACTIVE_HEALTHY",
      linked: true,
      created_at: OBSERVED_AT,
      database: {
        postgres_engine: "17",
        password: secretSentinel,
        host: secretSentinel,
      },
      api_keys: [{ value: secretSentinel }],
    },
  ])
  const backupEvidence = selectSupabaseBackupsMetadata({
    region: "eu-west-2",
    walg_enabled: true,
    pitr_enabled: true,
    physical_backup_data: { secret: secretSentinel },
    backups: [
      {
        id: 1,
        inserted_at: OBSERVED_AT,
        is_physical_backup: true,
        status: "COMPLETED",
        value: secretSentinel,
      },
    ],
  })

  assert.doesNotMatch(
    JSON.stringify({ projects, backupEvidence }),
    new RegExp(secretSentinel)
  )
})
