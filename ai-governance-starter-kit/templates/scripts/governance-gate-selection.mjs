export const GATE_RUNNER_USAGE =
  "usage: node scripts/run-governance-gates.mjs [--spec <spec-id>]... [--record]"

export function parseGateRunnerArgs(args) {
  const specIds = []
  let record = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === "--record") {
      record = true
      continue
    }

    if (argument === "--spec") {
      const id = args[index + 1]
      if (!id || id.startsWith("--")) {
        throw new Error(`--spec requires a Micro-Spec id.\n${GATE_RUNNER_USAGE}`)
      }
      specIds.push(id)
      index += 1
      continue
    }

    throw new Error(`Unknown option "${argument}".\n${GATE_RUNNER_USAGE}`)
  }

  return { record, specIds: [...new Set(specIds)] }
}

export function selectGateSpecs(specs, specIds) {
  if (specIds.length === 0) {
    return specs.filter((spec) => spec.metadata.status === "active")
  }

  const byId = new Map(specs.map((spec) => [spec.metadata.spec_id, spec]))
  const missing = specIds.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    throw new Error(`No Micro-Spec found for: ${missing.join(", ")}.`)
  }

  return specIds.map((id) => byId.get(id))
}

export function gateUnionForSpecs(specs) {
  return [
    ...new Set(specs.flatMap((spec) => spec.metadata.verification_gates ?? [])),
  ]
}
