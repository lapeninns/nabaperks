export function selectVercelProjectMetadata(raw) {
  return {
    id: raw.id,
    name: raw.name,
    nodeVersion: raw.nodeVersion,
    link: raw.link
      ? {
          type: raw.link.type,
          org: raw.link.org,
          repo: raw.link.repo,
          productionBranch: raw.link.productionBranch,
        }
      : null,
    gitForkProtection: raw.gitForkProtection,
    directoryListing: raw.directoryListing,
    protectedSourcemaps: raw.protectedSourcemaps,
    oidcTokenConfig: raw.oidcTokenConfig
      ? {
          enabled: raw.oidcTokenConfig.enabled,
          issuerMode: raw.oidcTokenConfig.issuerMode,
        }
      : null,
    gitProviderOptions: raw.gitProviderOptions
      ? {
          createDeployments: raw.gitProviderOptions.createDeployments,
        }
      : null,
    customEnvironments: (raw.customEnvironments ?? []).map(
      ({ name, slug, type }) => ({ name, slug, type })
    ),
    protectionBypassCount: Object.keys(raw.protectionBypass ?? {}).length,
    crons: (raw.crons?.definitions ?? []).map(({ path, schedule }) => ({
      path,
      schedule,
    })),
  }
}

// Deliberately excludes deployment metadata, URLs, environment and build logs.
export function selectDeploymentMetadata(raw) {
  return { id: raw.uid ?? raw.id, source: raw.source, created: raw.created }
}
