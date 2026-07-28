function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

function targetForEnvironment(contract, environment) {
  const target = contract.environments?.[environment]
  if (target) return target

  if (environment !== "development") {
    throw new Error(`Unknown Vercel environment: ${environment}`)
  }

  return {
    forbiddenKeys: [
      ...new Set(
        Object.values(contract.environments ?? {}).flatMap(
          ({ forbiddenKeys = [] }) => forbiddenKeys
        )
      ),
    ],
    requiredAnyOf: [],
    requiredKeys: [],
  }
}

export function requiredEnvironmentGaps(contract, environment, values) {
  const target = targetForEnvironment(contract, environment)
  const missingKeys = target.requiredKeys.filter(
    (name) => !nonEmpty(values[name])
  )
  const missingAlternatives = (target.requiredAnyOf ?? [])
    .filter(
      (alternatives) =>
        !alternatives.some((names) =>
          names.every((name) => nonEmpty(values[name]))
        )
    )
    .map((alternatives) => alternatives.map((names) => [...names]))

  return { missingAlternatives, missingKeys }
}

export function planVercelEnvironmentSync({
  contract,
  environment,
  existingNames,
  localNames,
  localValues,
  pruneForbidden = false,
  replace = false,
}) {
  const target = targetForEnvironment(contract, environment)
  const forbidden = new Set(target.forbiddenKeys ?? [])
  const existing = new Set(existingNames)
  const populated = localNames.filter((name) => nonEmpty(localValues[name]))
  const excludedLocal = populated.filter((name) => forbidden.has(name))
  const eligible = populated.filter((name) => !forbidden.has(name))
  const existingForbidden = [...existing].filter((name) => forbidden.has(name))

  return {
    add: eligible.filter((name) => !existing.has(name)),
    existingForbidden: existingForbidden.sort(),
    excludedLocal,
    removeForbidden: pruneForbidden ? existingForbidden.sort() : [],
    replace: replace ? eligible.filter((name) => existing.has(name)) : [],
    skip: replace ? [] : eligible.filter((name) => existing.has(name)),
  }
}
