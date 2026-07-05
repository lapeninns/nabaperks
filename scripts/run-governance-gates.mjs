#!/usr/bin/env node
import { spawnSync } from "node:child_process"

import {
  isManualInspectionGate,
  parsePackageScriptGate,
  validateGovernance,
} from "./governance-rules.mjs"

const root = process.cwd()
const validation = validateGovernance(root)

if (!validation.ok) {
  console.error("Governance gates were not run because governance validation failed:")
  for (const failure of validation.failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

const gates = [
  ...new Set(
    validation.specs
      .filter((spec) => spec.metadata.status === "active")
      .flatMap((spec) => spec.metadata.verification_gates ?? [])
  ),
]

const runnable = gates.filter((gate) => !isManualInspectionGate(gate))

if (runnable.length === 0) {
  console.log("No active Micro-Spec verification gates to run.")
  process.exit(0)
}

for (const gate of gates) {
  if (isManualInspectionGate(gate)) {
    console.log(`Skipping manual inspection gate in CI runner: ${gate}`)
    continue
  }

  const parsed = parsePackageScriptGate(gate)
  if (!parsed) {
    console.error(`Unsupported gate command: ${gate}`)
    process.exit(1)
  }

  console.log(`\n$ ${gate}`)
  const child = spawnSync(parsed.manager, packageArgs(parsed), {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  })

  if (child.error) {
    console.error(`Gate failed to start: ${gate}`)
    console.error(child.error.message)
    process.exit(1)
  }
  if (child.status !== 0) {
    console.error(`Gate failed: ${gate}`)
    process.exit(child.status ?? 1)
  }
}

console.log(`\nGovernance gate runner passed: ${runnable.length} active gate(s).`)

function packageArgs(gate) {
  const base = gate.manager === "npm" ? ["run", gate.scriptName] : [gate.scriptName]
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
