// Pure command-parsing helpers shared by the whole engine (rules, io, the
// gate runner, and the factory-station CLIs). Keeping them here breaks the
// import cycle that would otherwise exist between governance-io.mjs and
// governance-rules.mjs.

import {
  CI_COMMAND_INCLUDE_PATTERN,
  KNOWN_MANUAL_INSPECTION_GATES,
  KNOWN_MANUAL_INSPECTION_GATE_PATTERNS,
  NON_GATE_SCRIPT_NAMES,
} from "./governance-constants.mjs"

// Parse "<manager> [run] <script> [args]" for npm, pnpm, yarn, and bun.
// Returns null for anything else — which is exactly what makes arbitrary
// shell commands invalid as gates.
export function parsePackageScriptGate(command) {
  const trimmed = command.trim()
  const npm = trimmed.match(/^npm\s+run\s+([A-Za-z0-9:_-]+)(?:\s+(.+))?$/)
  if (npm) return { manager: "npm", scriptName: npm[1], args: npm[2] }

  const generic = trimmed.match(
    /^(pnpm|yarn|bun)(?:\s+run)?\s+([A-Za-z0-9:_-]+)(?:\s+(.+))?$/
  )
  if (generic) {
    return { manager: generic[1], scriptName: generic[2], args: generic[3] }
  }

  return null
}

export function isManualInspectionGate(command) {
  return (
    KNOWN_MANUAL_INSPECTION_GATE_PATTERNS.some((pattern) => pattern.test(command)) ||
    KNOWN_MANUAL_INSPECTION_GATES.includes(command)
  )
}

// The symmetric filter used on BOTH sides of the docs-drift comparison: a
// line (from a CI workflow or from the README gate list) counts as a gate
// command only when it parses as a package-script invocation, is not a
// setup/lifecycle script, and passes the repo's include pattern (when set).
// Applying the identical filter to both sides means a line excluded from one
// side can never produce a spurious mismatch against the other.
export function isGateCommandCandidate(command) {
  const parsed = parsePackageScriptGate(command)
  if (!parsed) return false
  if (NON_GATE_SCRIPT_NAMES.includes(parsed.scriptName)) return false
  if (CI_COMMAND_INCLUDE_PATTERN && !CI_COMMAND_INCLUDE_PATTERN.test(command.trim())) {
    return false
  }
  return true
}
