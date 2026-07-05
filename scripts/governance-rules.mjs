import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

import {
  isManualInspectionGate,
  parsePackageScriptGate,
} from "./governance-commands.mjs"
import {
  DURABLE_PROOF_SCRIPTS,
  EVIDENCE_ADOPTION_DATE,
  EVIDENCE_DIR,
  EVIDENCE_GATE_INFERENCE,
  RELATED_TESTS_EXEMPT_STATUSES,
  RELATED_TESTS_SENTINEL,
  REQUIRED_METADATA_FIELDS,
  REQUIRE_EXCEPTION_EXPIRY,
  RISK_CLASSES,
  RISK_REQUIRED_SCRIPTS,
  SCRIPT_ALIASES,
  STALE_REVIEW_DAYS,
  STATUS_VALUES,
} from "./governance-constants.mjs"
import { evaluateLedger, readLedger } from "./governance-evidence.mjs"
import { matchesPattern } from "./governance-glob.mjs"
import {
  findChangedFiles,
  readCiCommands,
  readPackageScripts,
  readPlaywrightProjectNames,
  readReadmeGateCommands,
  readSpecs,
  specPath,
} from "./governance-io.mjs"

// Re-exported so the gate runner and existing tests keep a single import
// surface; the implementations live in governance-commands.mjs.
export { isManualInspectionGate, parsePackageScriptGate }

export function validateGovernance(root, options = {}) {
  const failures = []
  const now = options.now ?? new Date()
  const packageScripts = readPackageScripts(root, failures)
  const ciCommands = readCiCommands(root)
  const playwrightProjects = readPlaywrightProjectNames(root)
  const specs = readSpecs(root, failures)

  validateUniqueSpecIds(specs, failures)
  for (const spec of specs) {
    // A spec that failed strict parsing already has file:line failures; piling
    // metadata noise on top of a broken parse helps nobody.
    if (spec.parseErrors?.length > 0) continue
    validateMetadata(spec, packageScripts, playwrightProjects, root, now, failures)
  }
  for (const spec of activeSpecs(specs)) {
    if (spec.parseErrors?.length > 0) continue
    validateActiveSpec(spec, packageScripts, failures)
  }
  validateDocsDrift(root, ciCommands, failures)
  // "in" (not ??): an explicit evidenceAdoptionDate: null must DISABLE the
  // ledger contract, not fall through to the constant.
  const adoptionDate =
    "evidenceAdoptionDate" in options ? options.evidenceAdoptionDate : EVIDENCE_ADOPTION_DATE
  validateEvidenceLedgers(root, specs, adoptionDate, failures)

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

function validateMetadata(spec, packageScripts, playwrightProjects, root, now, failures) {
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

  for (const field of ["allowed_blast_radius", "implementation_surfaces"]) {
    for (const pattern of listField(spec, field)) {
      if (/\s/.test(pattern)) {
        failures.push(
          `${specPath(spec.file)} ${field} pattern "${pattern}" contains whitespace; patterns must be bare paths or globs.`
        )
      }
    }
  }

  validateRelatedTests(spec, root, failures)
  validateSurfacesWithinRadius(spec, failures)
  validateApprovedExceptions(spec, now, failures)
  validateReviewFreshness(spec, now, failures)

  for (const project of listField(spec, "required_playwright_projects")) {
    if (playwrightProjects.length > 0 && !playwrightProjects.includes(project)) {
      failures.push(`${specPath(spec.file)} declares unknown Playwright project "${project}".`)
    }
  }

  for (const gate of listField(spec, "verification_gates")) {
    if (!isValidGate(gate, packageScripts)) {
      failures.push(`${specPath(spec.file)} declares unknown or unsafe gate "${gate}".`)
    }
  }
}

function validateRelatedTests(spec, root, failures) {
  if (RELATED_TESTS_EXEMPT_STATUSES.includes(spec.metadata.status)) return

  for (const entry of listField(spec, "related_tests")) {
    if (entry === RELATED_TESTS_SENTINEL) continue
    if (entry.includes("*")) {
      failures.push(
        `${specPath(spec.file)} related_tests entry "${entry}" is a glob; list literal paths or "${RELATED_TESTS_SENTINEL}".`
      )
      continue
    }
    if (!existsSync(join(root, entry))) {
      failures.push(`${specPath(spec.file)} related_tests entry "${entry}" does not exist.`)
    }
  }
}

function validateSurfacesWithinRadius(spec, failures) {
  const radius = listField(spec, "allowed_blast_radius")
  if (radius.length === 0) return

  for (const surface of listField(spec, "implementation_surfaces")) {
    const covered =
      radius.includes(surface) ||
      radius.some((pattern) => matchesPattern(surface, pattern))
    if (!covered) {
      failures.push(
        `${specPath(spec.file)} implementation surface "${surface}" is outside the spec's own allowed_blast_radius.`
      )
    }
  }
}

function validateApprovedExceptions(spec, now, failures) {
  if (!REQUIRE_EXCEPTION_EXPIRY) return

  const today = isoDate(now)
  for (const entry of listField(spec, "approved_exceptions")) {
    const match = String(entry).match(/\(expires:\s*(\d{4}-\d{2}-\d{2})\)/)
    if (!match) {
      failures.push(
        `${specPath(spec.file)} approved_exceptions entry "${entry}" must end with "(expires: YYYY-MM-DD)".`
      )
      continue
    }
    if (match[1] < today) {
      failures.push(
        `${specPath(spec.file)} approved_exceptions entry expired on ${match[1]}: "${entry}".`
      )
    }
  }
}

function validateReviewFreshness(spec, now, failures) {
  if (STALE_REVIEW_DAYS === null || spec.metadata.status !== "active") return
  const reviewed = Date.parse(spec.metadata.last_reviewed ?? "")
  if (Number.isNaN(reviewed)) return

  const ageDays = Math.floor((now.getTime() - reviewed) / 86_400_000)
  if (ageDays > STALE_REVIEW_DAYS) {
    failures.push(
      `${specId(spec)} is active but last_reviewed is ${ageDays} days old (limit ${STALE_REVIEW_DAYS}); re-review the spec and bump the date.`
    )
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
    } else if (listField(spec, "approved_exceptions").length === 0) {
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
    if (listField(spec, "required_playwright_projects").length === 0) {
      failures.push(`${specId(spec)} declares a browser gate but required_playwright_projects is empty.`)
    }
    if (!hasRelatedBrowserTest(spec)) {
      failures.push(`${specId(spec)} declares a browser gate but has no related tests/e2e|a11y|visual test.`)
    }
  }

  const evidence = listField(spec, "evidence_required").join(" ").toLowerCase()
  for (const { keyword, script } of EVIDENCE_GATE_INFERENCE) {
    if (evidence.includes(keyword) && scriptExists(packageScripts, script) && !hasScriptGate(spec, script)) {
      failures.push(`${specId(spec)} declares "${keyword}" evidence but no "${script}" gate.`)
    }
  }
}

// Docs-drift is bidirectional: CI must not run a gate command the README's
// gate section omits (docs rot), and the README must not list a gate command
// CI never runs (aspirational docs). Both sides pass through the identical
// isGateCommandCandidate filter in governance-io.mjs, so setup lines and
// prose can never produce a spurious mismatch.
function validateDocsDrift(root, ciCommands, failures) {
  const readmeCommands = readReadmeGateCommands(root)
  if (readmeCommands === null) return

  for (const command of ciCommands) {
    if (!readmeCommands.includes(command)) {
      failures.push(
        `micro-specs/README.md Current Verification Gates omits CI command "${command}".`
      )
    }
  }
  for (const command of readmeCommands) {
    if (!ciCommands.includes(command)) {
      failures.push(
        `micro-specs/README.md Current Verification Gates lists "${command}" but no CI workflow runs it.`
      )
    }
  }
}

// Ledger contract for implemented/verified specs, plus orphan detection —
// entirely disabled while the adoption date is null (pre-rollout).
function validateEvidenceLedgers(root, specs, adoptionDate, failures) {
  if (!adoptionDate) return

  for (const spec of specs) {
    if (spec.parseErrors?.length > 0) continue
    const ledger = spec.metadata.spec_id ? readLedger(root, spec.metadata.spec_id) : null
    failures.push(...evaluateLedger(spec, ledger, adoptionDate))
  }

  const dir = join(root, EVIDENCE_DIR)
  if (!existsSync(dir)) return
  const knownIds = new Set(specs.map((spec) => spec.metadata.spec_id).filter(Boolean))
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue
    const specId = entry.slice(0, -5)
    if (!knownIds.has(specId)) {
      failures.push(`${EVIDENCE_DIR}/${entry} is an orphan ledger: no Micro-Spec declares spec_id "${specId}".`)
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

  const consulted = active.map((spec) => specId(spec)).join(", ")
  for (const file of changedFiles) {
    const coveredBy = active.filter((spec) =>
      listField(spec, "allowed_blast_radius").some((pattern) => matchesPattern(file, pattern))
    )
    if (coveredBy.length === 0) {
      failures.push(
        `${file} is outside every active Micro-Spec allowed_blast_radius (consulted: ${consulted}).`
      )
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
  return listField(spec, "verification_gates").some((gate) => {
    const parsed = parsePackageScriptGate(gate)
    return parsed !== null && names.includes(parsed.scriptName)
  })
}

function hasExactGate(spec, gateCommand) {
  return listField(spec, "verification_gates").includes(gateCommand)
}

function scriptExists(packageScripts, scriptName) {
  const names = SCRIPT_ALIASES[scriptName] ?? [scriptName]
  return names.some((name) => Boolean(packageScripts[name]))
}

function repoHasDurableProof(packageScripts) {
  return DURABLE_PROOF_SCRIPTS.some((name) => Boolean(packageScripts[name]))
}

function hasDurableProofGate(spec) {
  return listField(spec, "verification_gates").some((gate) => {
    const parsed = parsePackageScriptGate(gate)
    return parsed !== null && DURABLE_PROOF_SCRIPTS.includes(parsed.scriptName)
  })
}

function needsBrowserProof(spec) {
  return listField(spec, "verification_gates").some((gate) => {
    const parsed = parsePackageScriptGate(gate)
    return parsed !== null && /^test:(e2e|a11y|visual)$/.test(parsed.scriptName)
  })
}

function hasRelatedBrowserTest(spec) {
  return listField(spec, "related_tests").some((testPath) =>
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

function listField(spec, field) {
  const value = spec.metadata[field]
  return Array.isArray(value) ? value : []
}

function isoDate(now) {
  return now.toISOString().slice(0, 10)
}

function specId(spec) {
  return spec.metadata.spec_id ?? specPath(spec.file)
}
