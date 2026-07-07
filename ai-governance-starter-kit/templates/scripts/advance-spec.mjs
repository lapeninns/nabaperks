#!/usr/bin/env node
// Lifecycle station: the ONLY sanctioned way to change a Micro-Spec's status.
// Machine-enforces the transition policy, runs the spec's gates fresh,
// records evidence, and rewrites the status line surgically (the body is
// preserved byte-for-byte). A hand-edited status has no recorded transition
// and fails the checker once evidence enforcement is on.
//
// usage:
//   node scripts/advance-spec.mjs <spec-id> --to <active|implemented|verified|closed|superseded>
//       [--attest "<manual-gate> by <who>: <note>"]...   (verified)
//       [--ack "<exact evidence_required item>"]...      (verified)
//       [--superseded-by <spec-id> | --reason "<text>"]  (superseded)
//       [--allow-dirty --note "<why>"]
//       [--strict] [--dry-run] [--by <who>]
//
// Exit codes: 0 success, 1 refusal/gate failure, 2 usage.
//
// Crash-safety: the spec file is written BEFORE the ledger, so an interrupted
// advance leaves a status with no matching transition — which the checker
// catches (fail-closed), never a transition without a status.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  executeGates,
  gitInfo,
  isManualInspectionGate,
} from "./governance-commands.mjs"
import { parseFrontmatter } from "./governance-frontmatter.mjs"
import { matchesPattern } from "./governance-glob.mjs"
import {
  newLedger,
  readLedger,
  recordAttestation,
  recordRun,
  recordTransition,
  runEntryFor,
  runnableGates,
  writeLedger,
} from "./governance-evidence.mjs"
import { readSpecs, specPath } from "./governance-io.mjs"
import {
  REQUIRED_SECTION_HEADINGS,
  validateClosedRecord,
  validateGovernance,
} from "./governance-rules.mjs"

const ALLOWED_TRANSITIONS = Object.freeze({
  draft: ["active"],
  active: ["implemented", "superseded"],
  implemented: ["verified", "superseded"],
  verified: ["closed", "superseded"],
  closed: ["superseded"],
  superseded: [],
})

const root = process.cwd()
const options = parseArgs(process.argv.slice(2))

const specs = readSpecs(root, [])
const matches = specs.filter((spec) => spec.metadata.spec_id === options.specId)
if (matches.length === 0) refuse(`no Micro-Spec found with spec_id "${options.specId}"`)
if (matches.length > 1) {
  refuse(`spec_id "${options.specId}" resolves to ${matches.length} files; fix the duplicate first`)
}
const spec = matches[0]
const from = spec.metadata.status
const to = options.to

if (!ALLOWED_TRANSITIONS[from]) refuse(`current status "${from}" is not a known status`)
if (!ALLOWED_TRANSITIONS[from].includes(to)) {
  const allowed = ALLOWED_TRANSITIONS[from].join(", ") || "none"
  refuse(`transition "${from}->${to}" is not allowed; allowed from "${from}": ${allowed}`)
}

// --- Transition-specific preconditions --------------------------------------

if (to === "superseded") {
  if (Boolean(options.supersededBy) === Boolean(options.reason)) {
    refuse('superseding requires exactly one of --superseded-by <spec-id> or --reason "<text>"')
  }
  if (options.supersededBy) {
    const successor = specs.find((entry) => entry.metadata.spec_id === options.supersededBy)
    if (!successor) refuse(`--superseded-by "${options.supersededBy}" does not resolve to a checked-in spec`)
  }
}

const manualGates = (spec.metadata.verification_gates ?? []).filter(isManualInspectionGate)
if (to === "verified") {
  for (const gate of manualGates) {
    if (!options.attestations.some((entry) => entry.gate === gate)) {
      refuse(`verified requires an attestation for manual gate "${gate}" (--attest "${gate} by <who>: <note>")`)
    }
  }
  for (const entry of options.attestations) {
    if (!manualGates.includes(entry.gate)) {
      refuse(`--attest names "${entry.gate}", which is not a declared manual gate of ${options.specId}`)
    }
  }
  const evidenceItems = (spec.metadata.evidence_required ?? []).map((item) => String(item).trim())
  for (const item of evidenceItems) {
    if (!options.acks.includes(item)) {
      refuse(`verified requires an acknowledgement for evidence item:\n  --ack "${item}"`)
    }
  }
  for (const ack of options.acks) {
    if (!evidenceItems.includes(ack)) {
      refuse(`--ack does not match any evidence_required item exactly: "${ack}"`)
    }
  }
}

const git = gitInfo(root)
const runsGates = to === "implemented" || to === "verified" || to === "closed"

if (runsGates && git.dirty && !options.allowDirty) {
  refuse(
    "working tree is dirty; commit first so the recorded sha is the code that passed, or use --allow-dirty --note \"<why>\" (the checker will then require a dated evidence-waiver exception)"
  )
}
if (options.allowDirty && !options.note) refuse("--allow-dirty requires --note \"<why>\"")

// Blast-radius attribution for the branch diff (gates-running transitions).
if (runsGates) {
  const changed = branchChangedFiles(root)
  const activeOthers = specs.filter(
    (entry) => entry.metadata.status === "active" && entry.metadata.spec_id !== options.specId
  )
  const outside = []
  const otherSpec = []
  for (const file of changed) {
    const mine = (spec.metadata.allowed_blast_radius ?? []).some((pattern) =>
      matchesPattern(file, pattern)
    )
    if (mine) continue
    const owner = activeOthers.find((entry) =>
      (entry.metadata.allowed_blast_radius ?? []).some((pattern) => matchesPattern(file, pattern))
    )
    if (owner) otherSpec.push({ file, owner: owner.metadata.spec_id })
    else outside.push(file)
  }
  if (outside.length > 0) {
    refuse(
      `branch diff contains files outside ${options.specId}'s allowed_blast_radius:\n` +
        outside.map((file) => `  - ${file}`).join("\n")
    )
  }
  if (otherSpec.length > 0) {
    const lines = otherSpec.map((entry) => `  - ${entry.file} (covered by ${entry.owner})`)
    if (options.strict) {
      refuse(`--strict: branch diff contains files owned by other active specs:\n${lines.join("\n")}`)
    }
    console.warn(`warning: branch diff contains files covered only by other active specs:\n${lines.join("\n")}`)
  }
}

// --- Activation validation (draft -> active) ---------------------------------

const specAbsPath = join(root, "micro-specs", spec.file)
const originalSource = readFileSync(specAbsPath, "utf8")

if (to === "active") {
  for (const heading of REQUIRED_SECTION_HEADINGS) {
    if (!originalSource.includes(heading)) {
      refuse(`activation requires the section heading "${heading}" in the spec body`)
    }
  }
}

// --- Closed-record validation (verified -> closed) ----------------------------

if (to === "closed") {
  // The body must already be a rationale record; validated by exactly the
  // checker code that will re-validate it on every future run, and refused
  // BEFORE gates so a red rewrite costs seconds, not a gate run.
  const problems = validateClosedRecord({ ...spec, source: originalSource }, root)
  if (problems.length > 0) {
    console.error(`advance: ${options.specId} does not satisfy the closed-record contract:`)
    for (const problem of problems) console.error(`- ${problem}`)
    process.exit(1)
  }
}

const rewritten = rewriteFrontmatter(originalSource, { from, to, supersededBy: options.supersededBy })

if (to === "active") {
  // Validate exactly what will exist on disk: tentatively write, validate,
  // revert on failure.
  if (!options.dryRun) {
    writeFileSync(specAbsPath, rewritten)
    const validation = validateGovernance(root, { enforceChangedFiles: false })
    const mine = validation.failures.filter(
      (failure) => failure.includes(options.specId) || failure.includes(specPath(spec.file))
    )
    if (mine.length > 0) {
      writeFileSync(specAbsPath, originalSource)
      console.error(`advance: activation validation failed for ${options.specId}:`)
      for (const failure of mine) console.error(`- ${failure}`)
      process.exit(1)
    }
  }
}

if (options.dryRun) {
  console.log(`dry-run: would advance ${options.specId} ${from} -> ${to}`)
  if (runsGates) console.log(`dry-run: would run ${runnableGates(spec).length} gate(s) fresh`)
  process.exit(0)
}

// --- Fresh gate run + evidence (implemented/verified) -------------------------

const timestamp = new Date().toISOString()
let executed = null

if (runsGates) {
  const gates = runnableGates(spec)
  // Scope the branch diff to the governance:check gate ONLY: it keeps
  // unrelated working-tree noise (other programs' WIP) from failing the
  // advance, while test gates stay hermetic — their own sandboxed governance
  // checks must never inherit this repo's changed-file list. Staleness is
  // exempt inside the advance's own gate run for the same reason as in
  // run-governance-gates: this fresh run is the cure, and the recorded
  // evidence lands at the sha the standalone check will then accept.
  const changed = branchChangedFiles(root)
  const envForGate = (parsed) => {
    const env = { ...process.env }
    delete env.GOVERNANCE_CHANGED_FILES
    delete env.GOVERNANCE_STALENESS_EXEMPT
    if (parsed.scriptName === "governance:check") {
      if (changed.length > 0) env.GOVERNANCE_CHANGED_FILES = changed.join(",")
      env.GOVERNANCE_STALENESS_EXEMPT = "*"
    }
    return env
  }
  executed = executeGates(root, gates, { envForGate })
  const failed = executed.find((result) => result.exit_code !== 0)
  if (failed) {
    const ledger = loadLedger(options.specId)
    recordRun(ledger, runEntryFor(spec, executed, git, timestamp))
    writeLedger(root, ledger)
    console.error(`advance: gate failed (${failed.command}); red run recorded, status unchanged.`)
    process.exit(1)
  }
}

// --- Commit the transition: spec file first, ledger second --------------------

if (to !== "active") writeFileSync(specAbsPath, rewritten)

const ledger = loadLedger(options.specId)
if (executed) recordRun(ledger, runEntryFor(spec, executed, git, timestamp))
for (const attestation of options.attestations) {
  recordAttestation(ledger, { ...attestation, at: timestamp })
}
for (const ack of options.acks) {
  recordAttestation(ledger, { gate: "evidence", by: options.by, at: timestamp, note: ack })
}
recordTransition(ledger, {
  from,
  to,
  at: timestamp,
  sha: git.sha,
  dirty: git.dirty,
  by: options.by,
  ...(options.supersededBy ? { superseded_by: options.supersededBy } : {}),
  ...(options.reason ? { reason: options.reason } : {}),
  ...(options.note ? { note: options.note } : {}),
})
const ledgerFile = writeLedger(root, ledger)

console.log(`advanced ${options.specId}: ${from} -> ${to}`)
console.log(`- spec:   micro-specs/${spec.file}`)
console.log(`- ledger: ${ledgerFile}`)
if (git.dirty) console.log("- note: recorded on a dirty tree (waiver required by the checker)")
console.log("Commit both files together.")

// --- helpers ------------------------------------------------------------------

function loadLedger(specId) {
  const existing = readLedger(root, specId)
  return existing && !existing.parseError ? existing : newLedger(specId)
}

function rewriteFrontmatter(source, { from: expectedFrom, to: target, supersededBy }) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!block) refuse("spec has no frontmatter block")

  let frontmatter = block[1]
  const statusLines = frontmatter.match(/^status:[ \t]*\S+[ \t]*$/gm) ?? []
  if (statusLines.length !== 1) {
    refuse(`expected exactly one status line in the frontmatter, found ${statusLines.length}`)
  }
  const current = statusLines[0].replace(/^status:[ \t]*/, "").trim()
  if (current !== expectedFrom) {
    refuse(`frontmatter status is "${current}", cannot apply ${expectedFrom}->${target}`)
  }

  frontmatter = frontmatter.replace(/^status:[ \t]*\S+[ \t]*$/m, `status: ${target}`)
  const today = new Date().toISOString().slice(0, 10)
  if (/^last_reviewed:.*$/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(/^last_reviewed:.*$/m, `last_reviewed: ${today}`)
  }
  if (supersededBy) {
    if (/^superseded_by:.*$/m.test(frontmatter)) {
      frontmatter = frontmatter.replace(/^superseded_by:.*$/m, `superseded_by: ${supersededBy}`)
    } else {
      frontmatter = frontmatter.replace(
        /^status:[ \t]*\S+[ \t]*$/m,
        (line) => `${line}\nsuperseded_by: ${supersededBy}`
      )
    }
  }

  const next = source.replace(block[0], `---\n${frontmatter}\n---\n`)
  const reparsed = parseFrontmatter(next)
  if (!reparsed || reparsed.metadata.status !== target) {
    refuse("internal error: rewritten frontmatter failed its sanity re-parse")
  }
  return next
}

function branchChangedFiles(dir) {
  const base = ["origin/main", "origin/master", "main", "master"].find((ref) =>
    gitOk(dir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])
  )
  const range = base ? `${base}...HEAD` : "HEAD"
  return gitLines(dir, ["diff", "--name-only", "--diff-filter=ACMRTUXB", range])
}

function gitOk(dir, args) {
  try {
    execFileSync("git", args, { cwd: dir, stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function gitLines(dir, args) {
  try {
    return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch {
    return []
  }
}

function parseArgs(argv) {
  const parsed = {
    specId: null,
    to: null,
    attestations: [],
    acks: [],
    supersededBy: null,
    reason: null,
    allowDirty: false,
    note: null,
    strict: false,
    dryRun: false,
    by: process.env.USER ?? "unassigned",
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const take = () => {
      i += 1
      if (i >= argv.length) usage(`${arg} needs a value`)
      return argv[i]
    }
    if (!arg.startsWith("--")) {
      if (parsed.specId) usage(`unexpected argument "${arg}"`)
      parsed.specId = arg
    } else if (arg === "--to") parsed.to = take()
    else if (arg === "--attest") parsed.attestations.push(parseAttestation(take()))
    else if (arg === "--ack") parsed.acks.push(take().trim())
    else if (arg === "--superseded-by") parsed.supersededBy = take()
    else if (arg === "--reason") parsed.reason = take()
    else if (arg === "--allow-dirty") parsed.allowDirty = true
    else if (arg === "--note") parsed.note = take()
    else if (arg === "--strict") parsed.strict = true
    else if (arg === "--dry-run") parsed.dryRun = true
    else if (arg === "--by") parsed.by = take()
    else usage(`unknown flag "${arg}"`)
  }

  if (!parsed.specId) usage("a <spec-id> argument is required")
  if (!["active", "implemented", "verified", "closed", "superseded"].includes(parsed.to ?? "")) {
    usage("--to must be one of: active, implemented, verified, closed, superseded")
  }
  return parsed
}

function parseAttestation(value) {
  const match = value.match(/^(\S+) by (.+?): (.+)$/)
  if (!match) usage(`--attest must look like "<manual-gate> by <who>: <note>" (got "${value}")`)
  return { gate: match[1], by: match[2], note: match[3] }
}

function refuse(message) {
  console.error(`advance: ${message}`)
  process.exit(1)
}

function usage(problem) {
  console.error(`advance: ${problem}`)
  console.error(
    'usage: node scripts/advance-spec.mjs <spec-id> --to <active|implemented|verified|closed|superseded> [--attest "<gate> by <who>: <note>"]... [--ack "<evidence item>"]... [--superseded-by <id> | --reason "<text>"] [--allow-dirty --note "<why>"] [--strict] [--dry-run] [--by <who>]'
  )
  process.exit(2)
}
