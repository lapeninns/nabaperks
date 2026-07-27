import { spawnSync } from "node:child_process"

import { selectVercelProjectMetadata } from "./project-metadata.mjs"

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
    const result = vercelJson(["env", "ls", name, ...scopeArgs])
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
    checks: checks.checks ?? [],
    environments,
  }
}
