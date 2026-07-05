#!/usr/bin/env node
// The evidence ledger: one tracked JSON file per Micro-Spec under
// EVIDENCE_DIR recording gate runs, lifecycle transitions, and manual
// attestations. The ledger is what turns "trust me, the gates passed" into a
// reviewable artifact — and what the checker validates for implemented /
// verified specs once EVIDENCE_ADOPTION_DATE is set.
//
// Design invariants:
// - Only the LATEST run is ever judged (older entries are history/context),
//   so the cap can never hide anything.
// - Coverage is exact-string: every currently declared runnable gate must
//   appear in the latest run with exit_code 0. Renaming a gate invalidates
//   old evidence by construction — re-proving is the point.
// - all_passed is recomputed from exit codes during evaluation; a hand-edited
//   flag that disagrees with its own gates is itself a failure.
//
// CLI:
//   node scripts/governance-evidence.mjs show <spec-id>
//   node scripts/governance-evidence.mjs backfill --by <who>   (grandfather stubs)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { isManualInspectionGate } from "./governance-commands.mjs"
import { EVIDENCE_ADOPTION_DATE, EVIDENCE_DIR } from "./governance-constants.mjs"

export const LEDGER_SCHEMA_VERSION = 1
export const GRANDFATHER_GATE = "evidence:grandfathered"
export const RUN_HISTORY_CAP = 10

export function ledgerPath(root, specId) {
  return join(root, EVIDENCE_DIR, `${specId}.json`)
}

export function readLedger(root, specId) {
  const file = ledgerPath(root, specId)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    return { parseError: error instanceof Error ? error.message : String(error) }
  }
}

export function newLedger(specId) {
  return {
    schema: LEDGER_SCHEMA_VERSION,
    spec_id: specId,
    runs: [],
    manual_attestations: [],
    transitions: [],
  }
}

// Deterministic serialization: fixed top-level key order, 2-space indent,
// trailing newline — so ledgers diff cleanly and byte-compare across runs.
export function writeLedger(root, ledger) {
  const file = ledgerPath(root, ledger.spec_id)
  mkdirSync(dirname(file), { recursive: true })
  const ordered = {
    schema: ledger.schema ?? LEDGER_SCHEMA_VERSION,
    spec_id: ledger.spec_id,
    runs: ledger.runs ?? [],
    manual_attestations: ledger.manual_attestations ?? [],
    transitions: ledger.transitions ?? [],
  }
  writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`)
  return file
}

export function recordRun(ledger, run) {
  ledger.runs = [...(ledger.runs ?? []), run].slice(-RUN_HISTORY_CAP)
  return ledger
}

export function recordTransition(ledger, transition) {
  ledger.transitions = [...(ledger.transitions ?? []), transition]
  return ledger
}

export function recordAttestation(ledger, attestation) {
  ledger.manual_attestations = [...(ledger.manual_attestations ?? []), attestation]
  return ledger
}

export function runnableGates(spec) {
  return (spec.metadata.verification_gates ?? []).filter(
    (gate) => !isManualInspectionGate(gate)
  )
}

// Build a run entry for ONE spec out of a (possibly wider) set of executed
// gate results — this is how a single union execution attributes per-spec
// evidence without re-running anything.
export function runEntryFor(spec, executedResults, git, timestamp) {
  const declared = runnableGates(spec)
  const gates = executedResults.filter((result) => declared.includes(result.command))
  const all_passed =
    declared.length > 0 &&
    declared.every((gate) =>
      gates.some((result) => result.command === gate && result.exit_code === 0)
    )
  return {
    timestamp,
    git_sha: git.sha,
    git_branch: git.branch,
    dirty: git.dirty,
    gates,
    all_passed,
  }
}

// Checker-side validation. Returns failure strings (empty = healthy).
// Gated entirely on adoptionDate: null disables the ledger contract.
export function evaluateLedger(spec, ledger, adoptionDate) {
  if (!adoptionDate) return []
  const status = spec.metadata.status
  if (status !== "implemented" && status !== "verified") return []

  const id = spec.metadata.spec_id ?? spec.file
  if (!ledger) {
    return [
      `${id} is ${status} but has no evidence ledger (${EVIDENCE_DIR}/${id}.json); run the gates with --record or backfill a grandfather stub.`,
    ]
  }
  if (ledger.parseError) {
    return [`${id} evidence ledger is not valid JSON: ${ledger.parseError}`]
  }
  if (ledger.spec_id !== id) {
    return [`${id} evidence ledger carries mismatched spec_id "${ledger.spec_id}".`]
  }

  const failures = []

  // Grandfather stubs: valid only while the spec has never machine-
  // transitioned AND the stub predates (or matches) the adoption date. The
  // first real transition permanently disqualifies the stub.
  const grandfather = (ledger.manual_attestations ?? []).find(
    (entry) => entry.gate === GRANDFATHER_GATE
  )
  if (grandfather && (ledger.transitions ?? []).length === 0) {
    if ((grandfather.at ?? "").slice(0, 10) <= adoptionDate) return []
    failures.push(
      `${id} grandfather stub is dated after the evidence adoption date (${adoptionDate}).`
    )
  }

  // Provenance: the current status must have been reached by a recorded
  // transition — a hand-flipped status line has no matching entry.
  const reached = (ledger.transitions ?? []).some((entry) => entry.to === status)
  if (!reached) {
    failures.push(
      `${id} is ${status} but the ledger records no transition to "${status}" (status lines are rewritten by governance:advance, not by hand).`
    )
  }

  const latestTransition = (ledger.transitions ?? []).at(-1)
  if (latestTransition?.dirty === true && !hasEvidenceWaiver(spec)) {
    failures.push(
      `${id} latest transition was recorded on a dirty tree; add a dated "evidence-waiver" approved_exceptions entry or re-advance from a clean tree.`
    )
  }

  // Covering run: latest run must contain every currently declared runnable
  // gate with exit 0, and its all_passed flag must agree with its own data.
  const latest = (ledger.runs ?? []).at(-1)
  if (!latest) {
    failures.push(`${id} evidence ledger has no recorded gate runs.`)
    return failures
  }

  const recomputed =
    (latest.gates ?? []).length > 0 &&
    (latest.gates ?? []).every((gate) => gate.exit_code === 0)
  if (Boolean(latest.all_passed) !== recomputed) {
    failures.push(
      `${id} evidence ledger is inconsistent: latest run all_passed=${latest.all_passed} disagrees with its recorded exit codes.`
    )
  }

  for (const gate of runnableGates(spec)) {
    const hit = (latest.gates ?? []).find(
      (entry) => entry.command === gate && entry.exit_code === 0
    )
    if (!hit) {
      failures.push(
        `${id} latest evidence run does not cover gate "${gate}" (declared gates changed or the gate failed); re-run with --record.`
      )
    }
  }
  if (!latest.all_passed && recomputed === Boolean(latest.all_passed)) {
    failures.push(`${id} latest evidence run is red (all_passed: false).`)
  }

  return failures
}

function hasEvidenceWaiver(spec) {
  return (spec.metadata.approved_exceptions ?? []).some((entry) =>
    String(entry).includes("evidence-waiver")
  )
}

// --- CLI ---------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const [command, ...rest] = process.argv.slice(2)
  const root = process.cwd()

  if (command === "show") {
    const specId = rest[0]
    if (!specId) usage("show <spec-id>")
    const ledger = readLedger(root, specId)
    if (!ledger) {
      console.error(`No ledger at ${EVIDENCE_DIR}/${specId}.json`)
      process.exit(1)
    }
    console.log(JSON.stringify(ledger, null, 2))
  } else if (command === "backfill") {
    const byIndex = rest.indexOf("--by")
    const by = byIndex !== -1 ? rest[byIndex + 1] : null
    if (!by) usage("backfill --by <who>")
    const adoption = EVIDENCE_ADOPTION_DATE ?? new Date().toISOString().slice(0, 10)
    const { readSpecs } = await import("./governance-io.mjs")
    const specs = readSpecs(root, [])
    let created = 0
    for (const spec of specs) {
      const status = spec.metadata.status
      if (status !== "implemented" && status !== "verified") continue
      const id = spec.metadata.spec_id
      if (!id || readLedger(root, id)) continue
      const ledger = newLedger(id)
      recordAttestation(ledger, {
        gate: GRANDFATHER_GATE,
        by,
        at: `${adoption}T00:00:00.000Z`,
        note: `Pre-adoption ${status} spec grandfathered at evidence-ledger rollout.`,
      })
      writeLedger(root, ledger)
      created += 1
    }
    console.log(`Backfilled ${created} grandfather ledger stub(s) under ${EVIDENCE_DIR}/.`)
  } else {
    usage("show <spec-id> | backfill --by <who>")
  }
}

function usage(hint) {
  console.error(`usage: node scripts/governance-evidence.mjs ${hint}`)
  process.exit(2)
}
