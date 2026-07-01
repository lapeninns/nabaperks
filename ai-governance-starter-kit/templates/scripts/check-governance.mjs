#!/usr/bin/env node
import { validateGovernance } from "./governance-rules.mjs"

const result = validateGovernance(process.cwd())

if (!result.ok) {
  console.error("Governance check failed:")
  for (const failure of result.failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Governance check passed for ${result.specs.length} Micro-Spec(s).`)
