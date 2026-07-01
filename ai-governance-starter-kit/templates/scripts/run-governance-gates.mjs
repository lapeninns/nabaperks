#!/usr/bin/env node
import { spawnSync } from "node:child_process"

import { isManualInspectionGate, parsePackageScriptGate, validateGovernance } from "./governance-rules.mjs"

const result = validateGovernance(process.cwd())

if (!result.ok) {
  console.error("Governance check failed before running gates:")
  for (const failure of result.failures) console.error(`- ${failure}`)
  process.exit(1)
}

const gates = [
  ...new Set(
    result.specs
      .filter((spec) => spec.metadata.status === "active")
      .flatMap((spec) => spec.metadata.verification_gates ?? [])
      .filter((gate) => !isManualInspectionGate(gate))
  ),
]

for (const gate of gates) {
  const parsed = parsePackageScriptGate(gate)
  if (!parsed) {
    console.error(`Unsupported gate command: ${gate}`)
    process.exit(1)
  }

  console.log(`\n> ${gate}`)
  const child = spawnSync(parsed.manager, packageArgs(parsed), {
    stdio: "inherit",
    shell: false,
  })

  if (child.status !== 0) process.exit(child.status ?? 1)
}

console.log("\nGovernance gates passed.")

function packageArgs(gate) {
  const base =
    gate.manager === "npm"
      ? ["run", gate.scriptName]
      : gate.manager === "pnpm" || gate.manager === "bun"
        ? [gate.scriptName]
        : [gate.scriptName]

  if (!gate.args) return base
  return [...base, ...splitArgs(gate.args)]
}

function splitArgs(source) {
  const args = []
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g
  for (const match of source.matchAll(pattern)) {
    args.push(match[1] ?? match[2] ?? match[3])
  }
  return args
}
