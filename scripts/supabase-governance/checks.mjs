function finding(control, passed, detail) {
  return {
    control,
    status: passed ? "PASS" : "FAIL",
    detail,
  }
}

function sorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function migrationDiff(localVersions, remoteVersions) {
  const local = new Set(localVersions)
  const remote = new Set(remoteVersions)

  return {
    missingOnRemote: sorted(
      localVersions.filter((version) => !remote.has(version))
    ),
    remoteOnly: sorted(remoteVersions.filter((version) => !local.has(version))),
  }
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function completedPhysicalBackups(backups) {
  return backups
    .filter(
      ({ physical, status }) => physical === true && status === "COMPLETED"
    )
    .map((backup) => ({
      ...backup,
      timestamp: parseTimestamp(backup.insertedAt),
    }))
    .filter(({ timestamp }) => timestamp !== null)
    .sort((left, right) => right.timestamp - left.timestamp)
}

function hoursBetween(later, earlier) {
  return (later - earlier) / (60 * 60 * 1000)
}

function backupContinuity(backups, minimumCount, maximumGapHours) {
  if (backups.length < minimumCount) return false

  const observed = backups.slice(0, minimumCount)
  return observed
    .slice(0, -1)
    .every(
      (backup, index) =>
        hoursBetween(backup.timestamp, observed[index + 1].timestamp) <=
        maximumGapHours
    )
}

function migrationDetail(diff, duplicateLocalVersions) {
  const details = []
  if (duplicateLocalVersions.length) {
    details.push(
      `duplicate local versions: ${duplicateLocalVersions.join(", ")}`
    )
  }
  if (diff.missingOnRemote.length) {
    details.push(`missing on remote: ${diff.missingOnRemote.join(", ")}`)
  }
  if (diff.remoteOnly.length) {
    details.push(`remote-only: ${diff.remoteOnly.join(", ")}`)
  }
  return details.join("; ")
}

export function evaluateSupabaseGovernance(contract, evidence) {
  const findings = []
  const expected = contract.productionProject
  const project = (evidence.projects ?? []).find(
    ({ ref }) => ref === expected.ref
  )

  const identityReady =
    project?.ref === expected.ref &&
    project?.name === expected.name &&
    project?.organizationId === expected.organizationId &&
    project?.region === expected.region &&
    project?.postgresEngine === expected.postgresEngine
  findings.push(
    finding(
      "supabase:production-identity",
      identityReady,
      identityReady
        ? `${project.name} is the expected ${project.region} PostgreSQL ${project.postgresEngine} project`
        : "the expected production project identity, region or database engine is missing"
    )
  )

  findings.push(
    finding(
      "supabase:production-health",
      project?.status === expected.status,
      project?.status === expected.status
        ? `production reports ${project.status}`
        : `production status is ${project?.status ?? "unavailable"}`
    )
  )

  findings.push(
    finding(
      "supabase:production-link",
      project?.linked === true,
      project?.linked === true
        ? "the repository is linked to the production project"
        : "the repository is not linked to the expected production project"
    )
  )

  const localVersions = evidence.migrations?.localVersions ?? []
  const remoteVersions = evidence.migrations?.remoteVersions ?? []
  const duplicateLocalVersions =
    evidence.migrations?.duplicateLocalVersions ?? []
  const diff = migrationDiff(localVersions, remoteVersions)
  const migrationsAligned =
    localVersions.length > 0 &&
    remoteVersions.length > 0 &&
    duplicateLocalVersions.length === 0 &&
    diff.missingOnRemote.length === 0 &&
    diff.remoteOnly.length === 0
  findings.push(
    finding(
      "supabase:migration-ledger",
      migrationsAligned,
      migrationsAligned
        ? `${localVersions.length} source migrations exactly match the production ledger`
        : migrationDetail(diff, duplicateLocalVersions) ||
            "source or production migration evidence is empty"
    )
  )

  const target = contract.backups
  const backupEvidence = evidence.backups ?? {}
  findings.push(
    finding(
      "supabase:backup-region",
      backupEvidence.region === target.region &&
        backupEvidence.region === expected.region,
      backupEvidence.region === target.region
        ? `physical backups remain in ${backupEvidence.region}`
        : "backup region does not match the production recovery region"
    )
  )

  findings.push(
    finding(
      "supabase:walg",
      target.walgRequired !== true || backupEvidence.walgEnabled === true,
      backupEvidence.walgEnabled === true
        ? "WAL-G physical backups are enabled"
        : "WAL-G physical backups are not enabled"
    )
  )

  findings.push(
    finding(
      "supabase:pitr",
      target.pitrRequired !== true || backupEvidence.pitrEnabled === true,
      backupEvidence.pitrEnabled === true
        ? "point-in-time recovery is enabled"
        : "point-in-time recovery is disabled"
    )
  )

  const completed = completedPhysicalBackups(backupEvidence.backups ?? [])
  const observedAt = parseTimestamp(evidence.observedAt)
  const latestAgeHours =
    completed[0] && observedAt !== null
      ? hoursBetween(observedAt, completed[0].timestamp)
      : Number.POSITIVE_INFINITY
  const latestIsFresh =
    latestAgeHours >= 0 && latestAgeHours <= target.maximumLatestAgeHours
  findings.push(
    finding(
      "supabase:backup-freshness",
      latestIsFresh,
      latestIsFresh
        ? `latest completed physical backup is ${latestAgeHours.toFixed(1)} hours old`
        : `no completed physical backup is within ${target.maximumLatestAgeHours} hours`
    )
  )

  const continuous = backupContinuity(
    completed,
    target.minimumCompletedPhysicalBackups,
    target.maximumGapHours
  )
  findings.push(
    finding(
      "supabase:backup-continuity",
      continuous,
      continuous
        ? `${target.minimumCompletedPhysicalBackups} completed physical backups have no gap above ${target.maximumGapHours} hours`
        : `fewer than ${target.minimumCompletedPhysicalBackups} completed physical backups or a gap exceeds ${target.maximumGapHours} hours`
    )
  )

  const failedPhysical = (backupEvidence.backups ?? []).filter(
    ({ physical, status }) => physical === true && status !== "COMPLETED"
  )
  findings.push(
    finding(
      "supabase:backup-status",
      failedPhysical.length === 0,
      failedPhysical.length === 0
        ? "no failed physical backup appears in the provider readback"
        : `${failedPhysical.length} non-completed physical backup(s) need investigation`
    )
  )

  return findings
}
