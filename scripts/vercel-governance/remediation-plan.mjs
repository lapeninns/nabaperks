const PROTECTED_TYPES = new Set(["encrypted", "secret", "sensitive"])

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
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

function environmentGaps(contract, evidence) {
  return Object.entries(contract.environments).map(([environment, target]) => {
    const entries = evidence.environments?.[environment] ?? []
    const names = new Set(entries.map(({ key }) => key))
    const protectedNames = new Set([
      ...target.requiredKeys.filter((key) => !key.startsWith("NEXT_PUBLIC_")),
      ...(target.requiredAnyOf ?? []).flat(2),
    ])

    return {
      environment,
      missingKeys: target.requiredKeys.filter((key) => !names.has(key)),
      missingAlternatives: (target.requiredAnyOf ?? [])
        .filter(
          (alternatives) =>
            !alternatives.some((alternative) =>
              alternative.every((key) => names.has(key))
            )
        )
        .map((alternatives) =>
          alternatives.map((alternative) => [...alternative])
        ),
      unsafeProtectedKeys: sorted(
        entries
          .filter(
            ({ key, type }) =>
              protectedNames.has(key) && !PROTECTED_TYPES.has(type)
          )
          .map(({ key }) => key)
      ),
      forbiddenKeys: sorted(
        entries
          .filter(({ key }) => (target.forbiddenKeys ?? []).includes(key))
          .map(({ key }) => key)
      ),
    }
  })
}

function hasValueWork(gap) {
  return (
    gap.missingKeys.length > 0 ||
    gap.missingAlternatives.length > 0 ||
    gap.unsafeProtectedKeys.length > 0
  )
}

function deploymentCheckBody(target) {
  return {
    name: target.name,
    requires: target.requires,
    blocks: target.blocks,
    targets: [...target.targets],
    source: {
      kind: "git-provider",
      provider: "github",
      externalCheckName: target.externalCheckName,
    },
  }
}

export function buildVercelGovernanceRemediationPlan(contract, evidence) {
  const gaps = environmentGaps(contract, evidence)
  const valueGaps = gaps.filter(hasValueWork)
  const forbiddenGaps = gaps.filter(({ forbiddenKeys }) => forbiddenKeys.length)
  const checkGaps = contract.deploymentChecks.flatMap((target) => {
    const actual = (evidence.checks ?? []).find(
      ({ name }) => name === target.name
    )
    return checkMatches(target, actual) ? [] : [{ actual, target }]
  })
  const autoDeployNeedsChange =
    evidence.project?.gitProviderOptions?.createDeployments !==
    contract.git.createDeployments
  const operations = []

  if (valueGaps.length > 0) {
    operations.push({
      order: operations.length + 1,
      kind: "provision-protected-environment-values",
      status: "requires-protected-values",
      requiresProductionApproval: false,
      environments: valueGaps.map(
        ({
          environment,
          missingAlternatives,
          missingKeys,
          unsafeProtectedKeys,
        }) => ({
          environment,
          missingAlternatives,
          missingKeys,
          unsafeProtectedKeys,
        })
      ),
    })
  }

  if (forbiddenGaps.length > 0) {
    operations.push({
      order: operations.length + 1,
      kind: "remove-forbidden-runtime-variables",
      status: "requires-production-approval",
      requiresProductionApproval: true,
      environments: forbiddenGaps.map(({ environment, forbiddenKeys }) => ({
        environment,
        keys: forbiddenKeys,
      })),
    })
  }

  for (const { actual, target } of checkGaps) {
    const existingId =
      typeof actual?.id === "string" && actual.id.length > 0 ? actual.id : null
    operations.push({
      order: operations.length + 1,
      kind: existingId ? "update-deployment-check" : "create-deployment-check",
      status: "requires-production-approval",
      requiresProductionApproval: true,
      request: {
        method: existingId ? "PATCH" : "POST",
        path: existingId
          ? `/v2/projects/${contract.project.id}/checks/${existingId}`
          : `/v2/projects/${contract.project.id}/checks`,
        body: deploymentCheckBody(target),
      },
    })
  }

  if (autoDeployNeedsChange) {
    const prerequisiteKinds = [...new Set(operations.map(({ kind }) => kind))]
    operations.push({
      order: operations.length + 1,
      kind: "disable-git-auto-deploy",
      status:
        prerequisiteKinds.length === 0
          ? "requires-production-approval"
          : "deferred-until-prerequisites-pass",
      requiresProductionApproval: true,
      prerequisites: prerequisiteKinds,
      request: {
        method: "PATCH",
        path: `/v9/projects/${contract.project.id}`,
        body: {
          gitProviderOptions: {
            createDeployments: contract.git.createDeployments,
          },
        },
      },
    })
  }

  return {
    mode: "plan-only",
    containsProviderValues: false,
    project: {
      id: contract.project.id,
      name: contract.project.name,
      scope: contract.scope,
    },
    summary: {
      operationCount: operations.length,
      protectedValueOperations: valueGaps.length > 0 ? 1 : 0,
      productionApprovalOperations: operations.filter(
        ({ requiresProductionApproval }) => requiresProductionApproval
      ).length,
      deferredOperations: operations.filter(({ status }) =>
        status.startsWith("deferred-")
      ).length,
    },
    operations,
  }
}
