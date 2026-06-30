#!/usr/bin/env node
import { spawnSync } from "node:child_process"

import {
  isManualInspectionGate,
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

if (gates.length === 0) {
  console.log("No active Micro-Spec verification gates to run.")
  process.exit(0)
}

for (const gate of gates) {
  if (isManualInspectionGate(gate)) {
    console.log(`Skipping manual inspection gate in CI runner: ${gate}`)
    continue
  }

  const parts = splitCommand(gate)
  const command = parts[0]
  const args = parts.slice(1)

  console.log(`\n$ ${gate}`)

  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  })

  if (result.error) {
    console.error(`Gate failed to start: ${gate}`)
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`Gate failed: ${gate}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`\nGovernance gate runner passed: ${gates.length} active gate(s).`)

function splitCommand(command) {
  const parts = []
  let current = ""
  let quote = ""

  for (const character of command) {
    if (quote) {
      if (character === quote) {
        quote = ""
      } else {
        current += character
      }
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (/\s/.test(character)) {
      if (current) {
        parts.push(current)
        current = ""
      }
      continue
    }

    current += character
  }

  if (quote) {
    throw new Error(`Unclosed quote in gate command: ${command}`)
  }

  if (current) parts.push(current)

  return parts
}
