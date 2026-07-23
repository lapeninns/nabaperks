export function selectSupabaseProjectsMetadata(raw) {
  if (!Array.isArray(raw)) return []

  return raw.map((project) => ({
    ref: project.ref,
    name: project.name,
    organizationId: project.organization_id,
    region: project.region,
    status: project.status,
    linked: project.linked,
    createdAt: project.created_at,
    postgresEngine: project.database?.postgres_engine,
  }))
}

export function selectSupabaseBackupsMetadata(raw) {
  return {
    region: raw?.region,
    walgEnabled: raw?.walg_enabled,
    pitrEnabled: raw?.pitr_enabled,
    backups: Array.isArray(raw?.backups)
      ? raw.backups.map((backup) => ({
          id: backup.id,
          insertedAt: backup.inserted_at,
          physical: backup.is_physical_backup,
          status: backup.status,
        }))
      : [],
  }
}
