import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import {
  isManualInspectionGate,
  parsePackageScriptGate,
} from "./governance-commands.mjs"
import {
  BROAD_BROWSER_GATE_EXCEPTION_TOKEN,
  BROAD_RADIUS_EXCEPTION_TOKEN,
  BROAD_RADIUS_LIMIT,
  BROAD_RADIUS_ROOTS,
  DURABLE_PROOF_SCRIPTS,
  EVIDENCE_ADOPTION_DATE,
  EVIDENCE_DIR,
  EVIDENCE_GATE_INFERENCE,
  RELATED_TESTS_EXEMPT_STATUSES,
  RELATED_TESTS_SENTINEL,
  REQUIRED_METADATA_FIELDS,
  REQUIRE_EXCEPTION_EXPIRY,
  RISK_CLASSES,
  RISK_RADIUS_HINTS,
  RISK_REQUIRED_SCRIPTS,
  SCOPED_BROWSER_GATE_SCRIPTS,
  SCRIPT_ALIASES,
  STALE_REVIEW_DAYS,
  STATUS_VALUES,
} from "./governance-constants.mjs"
import { evaluateLedger, readLedger } from "./governance-evidence.mjs"
import { matchesPattern } from "./governance-glob.mjs"
import {
  findChangedFiles,
  namedSection,
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

// The six numbered headings that make a spec body a build plan. Activation
// requires all of them (enforced by the lifecycle CLI); a closed record must
// contain none of them.
export const REQUIRED_SECTION_HEADINGS = Object.freeze([
  "## 1. Exact Goal and User-Visible Outcomes",
  "## 2. Blast Radius",
  "## 3. Strict Constraints and Assumptions",
  "## 4. Decisions Already Made",
  "## 5. Behavioral Requirements (EARS)",
  "## 6. Verification Criteria and Task Breakdown",
])

// The headings a closed spec's body must carry instead: the rewrite from a
// build plan into a durable rationale record. "## Dead Ends" is required even
// when its content is "None." — the attestation is the point.
export const CLOSED_RECORD_HEADINGS = Object.freeze([
  "## Why It Exists",
  "## Invariants",
  "## Code Pointers",
  "## Dead Ends",
])

// A backtick-wrapped token inside "## Code Pointers" counts as a repo path
// only in this shape: at least one "/", no whitespace, no glob stars, no
// leading slash. Bare symbol names and URLs deliberately parse as prose.
const POINTER_PATH_PATTERN = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.()@\[\]-]+)+$/

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
    validateActiveSpec(spec, packageScripts, root, failures)
  }
  for (const spec of specs) {
    if (spec.parseErrors?.length > 0) continue
    if (spec.metadata.status !== "closed") continue
    failures.push(...validateClosedRecord(spec, root))
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

// The closed-record contract: a closed spec's body is a rationale record, not
// a build plan. Machine-checkable pieces only — required headings, the
// negative rule (no activation headings may remain), a pointer grammar whose
// extracted paths must exist (file OR directory — directory pointers are the
// sanctioned valve for volatile file names; a stale pointer is a failure, not
// a warning), and a ban on the related_tests sentinel. Shared verbatim by the
// checker (status === "closed") and the lifecycle CLI's --to closed
// precondition, so the advance refuses exactly what the checker would flag.
export function validateClosedRecord(spec, root) {
  const failures = []
  const where = specPath(spec.file)
  const source = spec.source ?? ""

  for (const heading of CLOSED_RECORD_HEADINGS) {
    if (!source.includes(heading)) {
      failures.push(`${where} closed record is missing the required heading "${heading}".`)
    }
  }

  for (const heading of REQUIRED_SECTION_HEADINGS) {
    if (source.includes(heading)) {
      failures.push(
        `${where} closed record still contains the build-plan heading "${heading}"; rewrite the body into a rationale record.`
      )
    }
  }

  const section = namedSection(source, "Code Pointers")
  if (section) {
    const pointerLines = section.split(/\r?\n/).filter((line) => /^\s*-\s/.test(line))
    if (pointerLines.length === 0) {
      failures.push(
        `${where} closed record "## Code Pointers" needs at least one "- " pointer line into the code.`
      )
    }
    for (const line of pointerLines) {
      const paths = [...line.matchAll(/`([^`]+)`/g)]
        .map((match) => match[1])
        .filter((candidate) => POINTER_PATH_PATTERN.test(candidate))
      if (paths.length === 0) {
        failures.push(
          `${where} closed record pointer line carries no backtick-wrapped repo path: "${line.trim()}".`
        )
        continue
      }
      for (const pointer of paths) {
        if (!existsSync(join(root, pointer))) {
          failures.push(
            `${where} closed record code pointer "${pointer}" does not resolve to an existing file or directory.`
          )
        }
      }
    }
  }

  if (listField(spec, "related_tests").includes(RELATED_TESTS_SENTINEL)) {
    failures.push(
      `${where} closed record cannot keep the "${RELATED_TESTS_SENTINEL}" related_tests sentinel; cite the real tests.`
    )
  }

  return failures
}

function validateActiveSpec(spec, packageScripts, root, failures) {
  validateRiskRadiusHints(spec, failures)
  validateRadiusBreadth(spec, failures)
  validateScopedGrepTags(spec, root, failures)

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

  validateScopedBrowserGates(spec, failures)

  const evidence = listField(spec, "evidence_required").join(" ").toLowerCase()
  for (const { keyword, script } of EVIDENCE_GATE_INFERENCE) {
    if (evidence.includes(keyword) && scriptExists(packageScripts, script) && !hasScriptGate(spec, script)) {
      failures.push(`${specId(spec)} declares "${keyword}" evidence but no "${script}" gate.`)
    }
  }
}

// The gate floor keys off the self-declared risk_class, so these hints stop
// a high-risk surface riding under a weaker class. Surfaces (the spec's
// claimed edit set) are checked, not the radius (a permission list), and the
// glob match runs in both directions so a broad surface glob cannot hide a
// hinted path.
function validateRiskRadiusHints(spec, failures) {
  for (const hint of RISK_RADIUS_HINTS) {
    if (hint.classes.includes(spec.metadata.risk_class)) continue
    for (const surface of listField(spec, "implementation_surfaces")) {
      if (matchesPattern(surface, hint.pattern) || matchesPattern(hint.pattern, surface)) {
        failures.push(
          `${specId(spec)} implementation surface "${surface}" matches high-risk path "${hint.pattern}"; declare risk_class ${hint.classes.join(" or ")} or restructure the surfaces.`
        )
      }
    }
  }
}

// One repo-wide active spec makes blast-radius enforcement vacuous for every
// file, so claiming more than BROAD_RADIUS_LIMIT exact broad roots must be
// said out loud via a dated exception. Scoped subpaths never count as broad.
function validateRadiusBreadth(spec, failures) {
  if (BROAD_RADIUS_ROOTS.length === 0) return
  const broad = listField(spec, "allowed_blast_radius").filter((entry) =>
    BROAD_RADIUS_ROOTS.includes(entry)
  )
  if (broad.length <= BROAD_RADIUS_LIMIT) return
  const waived = listField(spec, "approved_exceptions").some((entry) =>
    String(entry).includes(BROAD_RADIUS_EXCEPTION_TOKEN)
  )
  if (waived) return
  failures.push(
    `${specId(spec)} claims ${broad.length} broad radius roots (${broad.join(", ")}) where ${BROAD_RADIUS_LIMIT} is the limit; narrow the radius or record a "${BROAD_RADIUS_EXCEPTION_TOKEN}: <why> (expires: YYYY-MM-DD)" approved_exceptions entry.`
  )
}

// A scoped browser gate must prove THIS spec's surfaces: its --grep pattern
// has to select at least one of the spec's own declared browser tests. Raw
// file content is matched (a superset of the test titles Playwright greps)
// to keep false negatives low. Runs only once the related-browser-test rule
// is satisfied, so a missing harness fails once, not twice.
function validateScopedGrepTags(spec, root, failures) {
  if (SCOPED_BROWSER_GATE_SCRIPTS.length === 0) return
  const relatedBrowserTests = listField(spec, "related_tests").filter(
    (testPath) =>
      /^tests\/(e2e|a11y|visual)\//.test(testPath) && existsSync(join(root, testPath))
  )
  if (relatedBrowserTests.length === 0) return

  for (const gate of listField(spec, "verification_gates")) {
    const parsed = parsePackageScriptGate(gate)
    if (!parsed || !SCOPED_BROWSER_GATE_SCRIPTS.includes(parsed.scriptName)) continue
    const pattern = grepPatternOf(parsed.args ?? "")
    if (pattern === null) continue

    let regex
    try {
      regex = new RegExp(pattern)
    } catch {
      failures.push(
        `${specId(spec)} gate grep pattern ${JSON.stringify(pattern)} is not a valid regular expression.`
      )
      continue
    }
    const hit = relatedBrowserTests.some((testPath) =>
      regex.test(readFileSync(join(root, testPath), "utf8"))
    )
    if (!hit) {
      failures.push(
        `${specId(spec)} gate grep pattern ${JSON.stringify(pattern)} matches none of the spec's related browser tests (${relatedBrowserTests.join(", ")}); tag the spec's own tests or fix the pattern.`
      )
    }
  }
}

function grepPatternOf(args) {
  const match = args.match(/--grep(?:=|\s+)(?:"([^"]*)"|'([^']*)'|(\S+))/)
  if (!match) return null
  return match[1] ?? match[2] ?? match[3]
}

// Scoped-gate doctrine for ACTIVE specs: a browser-suite gate must be
// narrowed to the spec's own tests with --grep. A whole-suite run drags every
// unrelated browser surface into the spec's gate (and its recorded evidence),
// so bare runs are reserved for specs that deliberately change global browser
// behavior — said out loud via an approved_exceptions entry carrying the
// exception token (the engine-fixed dated-expiry format still applies to it).
// Only the scripts in SCOPED_BROWSER_GATE_SCRIPTS are policed; wrapper
// scripts that already embed a tag filter (e.g. a test:a11y script defined as
// `playwright test --grep @a11y`) belong off that list. --project flags are
// welcome but select devices, not tests, so they do not satisfy the rule.
function validateScopedBrowserGates(spec, failures) {
  if (SCOPED_BROWSER_GATE_SCRIPTS.length === 0) return
  const waived = listField(spec, "approved_exceptions").some((entry) =>
    String(entry).includes(BROAD_BROWSER_GATE_EXCEPTION_TOKEN)
  )
  if (waived) return

  for (const gate of listField(spec, "verification_gates")) {
    const parsed = parsePackageScriptGate(gate)
    if (!parsed || !SCOPED_BROWSER_GATE_SCRIPTS.includes(parsed.scriptName)) continue
    if (/(^|\s)--grep(=|\s)/.test(parsed.args ?? "")) continue
    failures.push(
      `${specId(spec)} declares broad browser gate "${gate}"; scope it with --grep "<spec-tag>" or record a "${BROAD_BROWSER_GATE_EXCEPTION_TOKEN}: <why> (expires: YYYY-MM-DD)" approved_exceptions entry.`
    )
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
