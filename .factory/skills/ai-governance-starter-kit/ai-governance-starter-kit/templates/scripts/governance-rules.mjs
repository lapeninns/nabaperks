import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  DURABLE_PROOF_SCRIPTS,
  EVIDENCE_GATE_INFERENCE,
  KNOWN_MANUAL_INSPECTION_GATES,
  MANUAL_INSPECTION_GATE_PATTERN,
  REQUIRED_METADATA_FIELDS,
  RISK_CLASSES,
  RISK_REQUIRED_SCRIPTS,
  SCRIPT_ALIASES,
  STATUS_VALUES,
} from "./governance-constants.mjs"
import {
  findChangedFiles,
  namedSection,
  readCiCommands,
  readPackageScripts,
  readPlaywrightProjectNames,
  readSpecs,
  specPath,
} from "./governance-io.mjs"

export function validateGovernance(root, options = {}) {
  const failures = []
  const packageScripts = readPackageScripts(root, failures)
  const ciCommands = readCiCommands(root)
  const playwrightProjects = readPlaywrightProjectNames(root)
  const specs = readSpecs(root, failures)

  validateUniqueSpecIds(specs, failures)
  for (const spec of specs) {
    validateMetadata(spec, packageScripts, playwrightProjects, failures)
  }
  for (const spec of activeSpecs(specs)) {
    validateActiveSpec(spec, packageScripts, failures)
  }
  validateDocsDrift(root, ciCommands, failures)

  const changedFiles =
    options.changedFiles ?? findChangedFiles(root, options.env ?? process.env)
  if (options.enforceChangedFiles ?? true) {
    validateBlastRadius(specs, changedFiles, failures)
  }

  return {
    ok: failures.length === 0,
    failures,
    specs,
    ciCommands,
    changedFiles,
  }
}

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
    MANUAL_INSPECTION_GATE_PATTERN.test(command) ||
    KNOWN_MANUAL_INSPECTION_GATES.includes(command)
  )
}

function validateMetadata(spec, packageScripts, playwrightProjects, failures) {
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!(field in spec.metadata)) {
      failures.push(`${specPath(spec.file)} is missing metadata field "${field}".`)
    }
  }

  if (!STATUS_VALUES.includes(spec.metadata.status)) {
    failures.push(`${specPath(spec.file)} has invalid status "${spec.metadata.status}".`)
  }
  if (!RISK_CLASSES.includes(spec.metadata.risk_class)) {
    failures.push(`${specPath(spec.file)} has invalid risk_class "${spec.metadata.risk_class}".`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spec.metadata.last_reviewed ?? "")) {
    failures.push(`${specPath(spec.file)} last_reviewed must be YYYY-MM-DD.`)
  }

  for (const field of [
    "allowed_blast_radius",
    "implementation_surfaces",
    "related_tests",
    "verification_gates",
    "evidence_required",
  ]) {
    if (!Array.isArray(spec.metadata[field]) || spec.metadata[field].length === 0) {
      failures.push(`${specPath(spec.file)} metadata "${field}" must be a non-empty list.`)
    }
  }

  for (const field of ["required_playwright_projects", "approved_exceptions"]) {
    if (!Array.isArray(spec.metadata[field])) {
      failures.push(`${specPath(spec.file)} metadata "${field}" must be a list.`)
    }
  }

  for (const project of spec.metadata.required_playwright_projects ?? []) {
    if (playwrightProjects.length > 0 && !playwrightProjects.includes(project)) {
      failures.push(`${specPath(spec.file)} declares unknown Playwright project "${project}".`)
    }
  }

  for (const gate of spec.metadata.verification_gates ?? []) {
    if (!isValidGate(gate, packageScripts)) {
      failures.push(`${specPath(spec.file)} declares unknown or unsafe gate "${gate}".`)
    }
  }
}

function validateActiveSpec(spec, packageScripts, failures) {
  const floor = RISK_REQUIRED_SCRIPTS[spec.metadata.risk_class]
  if (!floor) return

  for (const scriptName of floor.always ?? []) {
    if (!hasScriptGate(spec, scriptName)) {
      failures.push(
        `${specId(spec)} requires a "${scriptName}" gate for risk_class ${spec.metadata.risk_class}.`
      )
    }
  }

  for (const scriptName of floor.whenPresent ?? []) {
    if (scriptExists(packageScripts, scriptName) && !hasScriptGate(spec, scriptName)) {
      failures.push(
        `${specId(spec)} must declare a "${scriptName}" gate because that script exists (risk_class ${spec.metadata.risk_class}).`
      )
    }
  }

  if (floor.durableProof) {
    if (repoHasDurableProof(packageScripts)) {
      if (!hasDurableProofGate(spec)) {
        failures.push(
          `${specId(spec)} (risk_class ${spec.metadata.risk_class}) requires a durable-proof gate (one of: ${DURABLE_PROOF_SCRIPTS.join(", ")}).`
        )
      }
    } else if ((spec.metadata.approved_exceptions ?? []).length === 0) {
      failures.push(
        `${specId(spec)} (risk_class ${spec.metadata.risk_class}) has no durable-proof script available; add one or record an approved_exceptions entry explaining the gap.`
      )
    }
  }

  if (floor.manualReview && !hasExactGate(spec, floor.manualReview)) {
    failures.push(
      `${specId(spec)} (risk_class ${spec.metadata.risk_class}) requires a "${floor.manualReview}" gate.`
    )
  }

  if (needsBrowserProof(spec)) {
    if ((spec.metadata.required_playwright_projects ?? []).length === 0) {
      failures.push(`${specId(spec)} declares a browser gate but required_playwright_projects is empty.`)
    }
    if (!hasRelatedBrowserTest(spec)) {
      failures.push(`${specId(spec)} declares a browser gate but has no related tests/e2e|a11y|visual test.`)
    }
  }

  const evidence = (spec.metadata.evidence_required ?? []).join(" ").toLowerCase()
  for (const { keyword, script } of EVIDENCE_GATE_INFERENCE) {
    if (evidence.includes(keyword) && scriptExists(packageScripts, script) && !hasScriptGate(spec, script)) {
      failures.push(`${specId(spec)} declares "${keyword}" evidence but no "${script}" gate.`)
    }
  }
}

function validateDocsDrift(root, ciCommands, failures) {
  const readmePath = join(root, "micro-specs/README.md")
  if (!existsSync(readmePath)) return

  const section = namedSection(readFileSync(readmePath, "utf8"), "Current Verification Gates")
  for (const command of ciCommands) {
    if (!section.includes(command)) {
      failures.push(
        `micro-specs/README.md Current Verification Gates omits CI command "${command}".`
      )
    }
  }
}

function validateBlastRadius(specs, changedFiles, failures) {
  if (changedFiles.length === 0) return

  const active = activeSpecs(specs)
  if (active.length === 0) {
    failures.push(
      "Changed files exist, but no active Micro-Spec is available for blast-radius enforcement."
    )
    return
  }

  const allowed = active.flatMap((spec) => spec.metadata.allowed_blast_radius ?? [])
  for (const file of changedFiles) {
    if (!allowed.some((pattern) => matchesPattern(file, pattern))) {
      failures.push(`${file} is outside active Micro-Spec allowed_blast_radius.`)
    }
  }
}

function validateUniqueSpecIds(specs, failures) {
  const seen = new Map()
  for (const spec of specs) {
    const id = spec.metadata.spec_id
    if (!id) continue
    if (seen.has(id)) failures.push(`${specPath(spec.file)} duplicates spec_id "${id}".`)
    seen.set(id, spec.file)
  }
}

function isValidGate(command, packageScripts) {
  if (isManualInspectionGate(command)) return true
  const gate = parsePackageScriptGate(command)
  if (!gate) return false
  if (gate.scriptName === "governance:run-gates") return false
  if (!packageScripts[gate.scriptName]) return false
  if (gate.args && !isSafeGateArgs(gate.args)) return false
  return true
}

function hasScriptGate(spec, scriptName) {
  const names = SCRIPT_ALIASES[scriptName] ?? [scriptName]
  return (spec.metadata.verification_gates ?? []).some((gate) => {
    const parsed = parsePackageScriptGate(gate)
    return parsed !== null && names.includes(parsed.scriptName)
  })
}

function hasExactGate(spec, gateCommand) {
  return (spec.metadata.verification_gates ?? []).includes(gateCommand)
}

function scriptExists(packageScripts, scriptName) {
  const names = SCRIPT_ALIASES[scriptName] ?? [scriptName]
  return names.some((name) => Boolean(packageScripts[name]))
}

function repoHasDurableProof(packageScripts) {
  return DURABLE_PROOF_SCRIPTS.some((name) => Boolean(packageScripts[name]))
}

function hasDurableProofGate(spec) {
  return (spec.metadata.verification_gates ?? []).some((gate) => {
    const parsed = parsePackageScriptGate(gate)
    return parsed !== null && DURABLE_PROOF_SCRIPTS.includes(parsed.scriptName)
  })
}

function needsBrowserProof(spec) {
  return (spec.metadata.verification_gates ?? []).some((gate) => {
    const parsed = parsePackageScriptGate(gate)
    return parsed !== null && /^test:(e2e|a11y|visual)$/.test(parsed.scriptName)
  })
}

function hasRelatedBrowserTest(spec) {
  return (spec.metadata.related_tests ?? []).some((testPath) =>
    /^tests\/(e2e|a11y|visual)\//.test(testPath)
  )
}

function isSafeGateArgs(args) {
  // Pass-through flags only; never shell metacharacters. The gate runner uses
  // shell:false, so this is defense-in-depth plus an authoring lint.
  return /^-/.test(args.trim()) && !/[;&$`><\n\r]/.test(args)
}

function activeSpecs(specs) {
  return specs.filter((spec) => spec.metadata.status === "active")
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -3))
  if (!pattern.includes("*")) return file === pattern || file.startsWith(`${pattern}/`)
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
  return new RegExp(`^${escaped}$`).test(file)
}

function specId(spec) {
  return spec.metadata.spec_id ?? specPath(spec.file)
}
