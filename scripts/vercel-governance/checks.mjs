function finding(control, passed, detail) {
  return {
    control,
    status: passed ? "PASS" : "FAIL",
    detail,
  }
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function missingNames(required, entries) {
  const names = new Set(entries.map(({ key }) => key))
  return required.filter((name) => !names.has(name))
}

function describeAlternatives(alternatives) {
  return alternatives.map((names) => names.join(" + ")).join(" or ")
}

function environmentFindings(name, target, entries) {
  const findings = []
  const missing = missingNames(target.requiredKeys, entries)
  findings.push(
    finding(
      `vercel:environment:${name}:keys`,
      missing.length === 0,
      missing.length === 0
        ? `${target.requiredKeys.length} required variable names are configured`
        : `missing variable names: ${missing.join(", ")}`
    )
  )

  const names = new Set(entries.map(({ key }) => key))
  for (const [index, alternatives] of (target.requiredAnyOf ?? []).entries()) {
    const configured = alternatives.some((alternative) =>
      alternative.every((key) => names.has(key))
    )
    findings.push(
      finding(
        `vercel:environment:${name}:alternative-${index + 1}`,
        configured,
        configured
          ? `one credential alternative is configured`
          : `requires ${describeAlternatives(alternatives)}`
      )
    )
  }

  const protectedNames = new Set([
    ...target.requiredKeys.filter((key) => !key.startsWith("NEXT_PUBLIC_")),
    ...(target.requiredAnyOf ?? []).flat(2),
  ])
  const unsafe = entries
    .filter(
      ({ key, type }) =>
        protectedNames.has(key) &&
        !["encrypted", "secret", "sensitive"].includes(type)
    )
    .map(({ key }) => key)
  findings.push(
    finding(
      `vercel:environment:${name}:protected`,
      unsafe.length === 0,
      unsafe.length === 0
        ? "server-only variables use protected Vercel storage"
        : `server-only variables are not protected: ${unsafe.join(", ")}`
    )
  )

  const forbidden = entries
    .filter(({ key }) => (target.forbiddenKeys ?? []).includes(key))
    .map(({ key }) => key)
  findings.push(
    finding(
      `vercel:environment:${name}:scope`,
      forbidden.length === 0,
      forbidden.length === 0
        ? "release and database credentials are excluded from application runtime"
        : `move non-runtime credentials out of Vercel: ${forbidden.join(", ")}`
    )
  )

  return findings
}

function checkMatches(target, actual) {
  return (
    actual?.name === target.name &&
    actual?.requires === target.requires &&
    actual?.blocks === target.blocks &&
    sameValues(actual?.targets ?? [], target.targets) &&
    actual?.source?.kind === "git-provider" &&
    actual?.source?.provider === "github" &&
    actual?.source?.externalCheckName === target.externalCheckName
  )
}

function cronKey({ path, schedule }) {
  return `${path}\u0000${schedule}`
}

export function evaluateVercelGovernance(contract, evidence) {
  const findings = []
  const project = evidence.project ?? {}
  const expectedProject = contract.project

  findings.push(
    finding(
      "vercel:project-identity",
      project.id === expectedProject.id &&
        project.name === expectedProject.name &&
        project.nodeVersion === expectedProject.nodeVersion,
      project.id === expectedProject.id && project.name === expectedProject.name
        ? `${project.name} is linked to the expected project and Node runtime`
        : "the linked Vercel project identity or Node runtime does not match"
    )
  )

  const link = project.link ?? {}
  const git = contract.git
  findings.push(
    finding(
      "vercel:github-link",
      link.type === git.type &&
        link.org === git.org &&
        link.repo === git.repo &&
        link.productionBranch === git.productionBranch,
      link.type === git.type && link.org === git.org && link.repo === git.repo
        ? `${link.org}/${link.repo} uses ${link.productionBranch} for production`
        : "the expected GitHub repository and production branch are not linked"
    )
  )

  const securityReady =
    project.gitForkProtection === true &&
    project.directoryListing === false &&
    project.protectedSourcemaps === true &&
    project.oidcTokenConfig?.enabled === true &&
    project.oidcTokenConfig?.issuerMode === "team"
  findings.push(
    finding(
      "vercel:project-security",
      securityReady,
      securityReady
        ? "fork protection, protected source maps, OIDC and directory controls are active"
        : "fork protection, source-map, OIDC or directory controls are incomplete"
    )
  )

  const createDeployments = project.gitProviderOptions?.createDeployments
  findings.push(
    finding(
      "vercel:git-auto-deploy",
      createDeployments === git.createDeployments,
      createDeployments === git.createDeployments
        ? "Git-provider deployments are disabled for the protected build-once path"
        : "Git-provider deployments remain enabled; disable them only after protected release credentials are live"
    )
  )

  const custom = (project.customEnvironments ?? []).find(
    ({ slug }) => slug === contract.customEnvironment.slug
  )
  findings.push(
    finding(
      "vercel:staging-target",
      custom?.name === contract.customEnvironment.name &&
        custom?.type === contract.customEnvironment.type,
      custom
        ? `${custom.name} is configured as a custom ${custom.type} target`
        : "the custom Staging target is missing"
    )
  )

  findings.push(
    finding(
      "vercel:automation-bypass",
      project.protectionBypassCount === contract.automationBypassCount,
      project.protectionBypassCount === contract.automationBypassCount
        ? "exactly one automation bypass credential is registered"
        : `${project.protectionBypassCount ?? 0} automation bypass credentials are registered; expected ${contract.automationBypassCount}`
    )
  )

  const expectedCrons = new Set(
    (contract.sourceCrons ?? []).map((cron) => cronKey(cron))
  )
  const liveCrons = new Set((project.crons ?? []).map((cron) => cronKey(cron)))
  const cronParity =
    expectedCrons.size === liveCrons.size &&
    [...expectedCrons].every((key) => liveCrons.has(key))
  findings.push(
    finding(
      "vercel:cron-parity",
      cronParity,
      cronParity
        ? `${liveCrons.size} live cron definitions match vercel.json`
        : "live cron definitions do not match vercel.json"
    )
  )

  for (const target of contract.deploymentChecks) {
    const actual = (evidence.checks ?? []).find(
      ({ name }) => name === target.name
    )
    findings.push(
      finding(
        `vercel:deployment-check:${target.name}`,
        checkMatches(target, actual),
        checkMatches(target, actual)
          ? `${target.name} blocks production alias assignment`
          : `${target.name} is missing or is not a blocking GitHub check`
      )
    )
  }

  for (const [name, target] of Object.entries(contract.environments)) {
    findings.push(
      ...environmentFindings(name, target, evidence.environments?.[name] ?? [])
    )
  }

  return findings
}
