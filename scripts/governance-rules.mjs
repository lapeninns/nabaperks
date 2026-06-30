import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  KNOWN_MANUAL_INSPECTION_GATE_PATTERNS,
  KNOWN_MANUAL_INSPECTION_GATES,
  REQUIRED_METADATA_FIELDS,
  RISK_CLASSES,
  RISK_REQUIRED_GATES,
  STATUS_VALUES,
} from "./governance-constants.mjs"
import {
  findChangedFiles,
  namedSection,
  readCiCommands,
  readPackageScripts,
  readSpecs,
} from "./governance-io.mjs"

export function validateGovernance(root, options = {}) {
  const failures = []
  const packageScripts = readPackageScripts(root, failures)
  const ciCommands = readCiCommands(root)
  const specs = readSpecs(root, failures)

  validateUniqueSpecIds(specs, failures)
  for (const spec of specs) {
    validateMetadata(spec, packageScripts, failures)
  }

  for (const spec of specs.filter((item) => item.metadata.status === "active")) {
    validateActiveSpec(spec, failures)
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

function validateMetadata(spec, packageScripts, failures) {
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!(field in spec.metadata)) {
      failures.push(`${specPath(spec.file)} is missing metadata field "${field}".`)
    }
  }

  if (!STATUS_VALUES.includes(spec.metadata.status)) {
    failures.push(`${specPath(spec.file)} has invalid status "${spec.metadata.status}".`)
  }
  if (!RISK_CLASSES.includes(spec.metadata.risk_class)) {
    failures.push(
      `${specPath(spec.file)} has invalid risk_class "${spec.metadata.risk_class}".`
    )
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

  for (const gate of spec.metadata.verification_gates ?? []) {
    if (!isValidGate(gate, packageScripts)) {
      failures.push(`${specPath(spec.file)} declares unknown gate "${gate}".`)
    }
  }
}

function validateActiveSpec(spec, failures) {
  const requiredGates = RISK_REQUIRED_GATES[spec.metadata.risk_class] ?? []
  for (const gate of requiredGates) {
    if (!hasGate(spec, gate)) {
      failures.push(`${specId(spec)} requires "${gate}" for risk_class ${spec.metadata.risk_class}.`)
    }
  }

  if (needsPlaywright(spec)) {
    if ((spec.metadata.required_playwright_projects ?? []).length === 0) {
      failures.push(`${specId(spec)} requires non-empty required_playwright_projects.`)
    }
    if (!hasRelatedBrowserTest(spec)) {
      failures.push(`${specId(spec)} requires related e2e/a11y/visual tests.`)
    }
  }

  const evidence = (spec.metadata.evidence_required ?? []).join(" ").toLowerCase()
  if (evidence.includes("a11y") && !hasGate(spec, "pnpm test:a11y")) {
    failures.push(`${specId(spec)} requires "pnpm test:a11y" for a11y evidence.`)
  }
  if (evidence.includes("visual") && !hasGate(spec, "pnpm test:visual")) {
    failures.push(`${specId(spec)} requires "pnpm test:visual" for visual evidence.`)
  }
}

function validateDocsDrift(root, ciCommands, failures) {
  const readmePath = join(root, "micro-specs/README.md")
  if (!existsSync(readmePath)) return
  const section = namedSection(readFileSync(readmePath, "utf8"), "Current Verification Gates")
  for (const command of ciCommands) {
    if (!section.includes(command)) {
      failures.push(`micro-specs/README.md Current Verification Gates omits CI command "${command}".`)
    }
  }
}

function validateBlastRadius(specs, changedFiles, failures) {
  if (changedFiles.length === 0) return
  const activeSpecs = specs.filter((spec) => spec.metadata.status === "active")
  if (activeSpecs.length === 0) {
    failures.push("Changed files exist, but no active Micro-Spec is available for blast-radius enforcement.")
    return
  }
  const allowed = activeSpecs.flatMap((spec) => spec.metadata.allowed_blast_radius ?? [])
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

  const gate = parsePnpmScriptGate(command)

  if (!gate) return false
  if (gate.scriptName === "governance:run-gates") return false
  if (!packageScripts[gate.scriptName]) return false
  if (!gate.args) return true

  return allowsScriptArgs(gate.scriptName, gate.args)
}

function hasGate(spec, requiredGate) {
  return (spec.metadata.verification_gates ?? []).some((gate) =>
    gate === requiredGate || gate.startsWith(`${requiredGate} `)
  )
}

function needsPlaywright(spec) {
  return (spec.metadata.verification_gates ?? []).some((gate) =>
    /^pnpm test:(e2e|a11y|visual)\b/.test(gate)
  )
}

function hasRelatedBrowserTest(spec) {
  return (spec.metadata.related_tests ?? []).some((testPath) =>
    /^tests\/(e2e|a11y|visual)\//.test(testPath)
  )
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -3))
  if (!pattern.includes("*")) return file === pattern || file.startsWith(`${pattern}/`)
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
  return new RegExp(`^${escaped}$`).test(file)
}

export function isManualInspectionGate(command) {
  return (
    KNOWN_MANUAL_INSPECTION_GATES.includes(command) ||
    KNOWN_MANUAL_INSPECTION_GATE_PATTERNS.some((pattern) =>
      pattern.test(command)
    )
  )
}

function parsePnpmScriptGate(command) {
  const match = command.match(
    /^pnpm(?: run)?\s+([A-Za-z0-9:_-]+)(?:\s+(.+))?$/
  )

  if (!match) return null

  return {
    args: match[2],
    scriptName: match[1],
  }
}

function allowsScriptArgs(scriptName, args) {
  if (!["test:e2e", "test:a11y", "test:visual"].includes(scriptName)) {
    return false
  }

  return /^--\s+(?:--project=[A-Za-z0-9_.:-]+|--grep\s+(?:"[^"]+"|'[^']+'|[A-Za-z0-9_@./:-]+))$/.test(
    args
  )
}

function specPath(file) {
  return `micro-specs/${file}`
}

function specId(spec) {
  return spec.metadata.spec_id ?? specPath(spec.file)
}
