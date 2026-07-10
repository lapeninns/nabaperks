#!/usr/bin/env node
// Runs Micro-Spec verification gates.
//
//   node scripts/run-governance-gates.mjs                    # union of ACTIVE specs' gates
//   node scripts/run-governance-gates.mjs --spec <spec-id>   # one spec's gates (any status)
//   node scripts/run-governance-gates.mjs --record           # also write evidence ledgers
//
// One union execution attributes per-spec evidence: each spec's ledger entry
// contains only ITS declared gates with the results from the shared run.
// With --record, a failing run is still recorded (all_passed: false) before
// exiting non-zero — the ledger keeps honest history, including red runs.

import { appendFileSync } from "node:fs"

import { executeGates, isManualInspectionGate, gitInfo } from "./governance-commands.mjs"
import {
  readLedger,
  newLedger,
  recordRun,
  runEntryFor,
  runnableGates,
  writeLedger,
} from "./governance-evidence.mjs"
import { readSpecs } from "./governance-io.mjs"
import { validateGovernance } from "./governance-rules.mjs"

const root = process.cwd()
const args = process.argv.slice(2)
const record = args.includes("--record")
const specIndex = args.indexOf("--spec")
const specId = specIndex !== -1 ? args[specIndex + 1] : null
if (specIndex !== -1 && !specId) {
  console.error("usage: node scripts/run-governance-gates.mjs [--spec <spec-id>] [--record]")
  process.exit(2)
}

// A mid-implementation tree legitimately has changed files everywhere; gate
// execution needs valid metadata, not blast-radius cleanliness. Re-proof
// state (staleness, red latest runs) is exempt for the same reason a
// recording run exists at all: this invocation IS the cure those failures
// prescribe, and it must not be blocked by the disease it is curing (the
// standalone governance:check keeps full enforcement).
const reprovingSpecIds = specId
  ? [specId]
  : readSpecs(root, [])
      .filter((spec) => spec.metadata.status === "active")
      .map((spec) => spec.metadata.spec_id)
      .filter(Boolean)
const inheritedReprovingSpecIds = String(
  process.env.GOVERNANCE_REPROVING_SPECS ?? ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
const gateReprovingSpecIds = [
  ...new Set([...reprovingSpecIds, ...inheritedReprovingSpecIds]),
]

const validation = validateGovernance(root, {
  enforceChangedFiles: false,
  reprovingSpecIds,
})

if (!validation.ok) {
  console.error("Governance gates were not run because governance validation failed:")
  for (const failure of validation.failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

let targetSpecs
if (specId) {
  targetSpecs = validation.specs.filter((spec) => spec.metadata.spec_id === specId)
  if (targetSpecs.length === 0) {
    console.error(`No Micro-Spec found with spec_id "${specId}".`)
    process.exit(1)
  }
} else {
  targetSpecs = validation.specs.filter((spec) => spec.metadata.status === "active")
}

const gates = [
  ...new Set(targetSpecs.flatMap((spec) => spec.metadata.verification_gates ?? [])),
]
const runnable = gates.filter((gate) => !isManualInspectionGate(gate))
const playwrightGateScripts = new Set(["test:e2e", "test:a11y", "test:visual"])
let playwrightGatePort = 3146

for (const gate of gates) {
  if (isManualInspectionGate(gate)) {
    console.log(`Skipping manual inspection gate in CI runner: ${gate}`)
  }
}

if (runnable.length === 0) {
  console.log("No runnable Micro-Spec verification gates to run.")
  process.exit(0)
}

for (const gate of runnable) console.log(`queued: ${gate}`)

// Every gate of a recording run carries the re-proving marker — not just
// governance:check: test suites embed real-repo validations that would
// otherwise re-impose the staleness/red-run failures this very run cures.
// Fixture-based tests stay hermetic by passing their own env explicitly.
const envForGate = (parsed) => {
  const env = {
    ...process.env,
    GOVERNANCE_REPROVING_SPECS: gateReprovingSpecIds.join(","),
  }

  if (isPlaywrightGate(parsed) && !process.env.PLAYWRIGHT_BASE_URL) {
    env.PLAYWRIGHT_BASE_URL = `http://127.0.0.1:${playwrightGatePort++}`
    env.PLAYWRIGHT_REUSE_EXISTING_SERVER = "0"
  }

  return env
}
const results = executeGates(root, runnable, { envForGate })
const failed = results.find((result) => result.exit_code !== 0)

if (record) {
  const git = gitInfo(root)
  const timestamp = new Date().toISOString()
  for (const spec of targetSpecs) {
    if (!spec.metadata.spec_id || runnableGates(spec).length === 0) continue
    const existing = readLedger(root, spec.metadata.spec_id)
    const ledger =
      existing && !existing.parseError ? existing : newLedger(spec.metadata.spec_id)
    recordRun(ledger, runEntryFor(spec, results, git, timestamp))
    const file = writeLedger(root, ledger)
    console.log(`recorded: ${file}`)
  }
}

writeStepSummary(results, failed)

if (failed) {
  console.error(`Gate failed: ${failed.command}`)
  if (failed.error) console.error(failed.error)
  process.exit(failed.exit_code ?? 1)
}

console.log(`\nGovernance gate runner passed: ${results.length} gate(s).`)

function writeStepSummary(gateResults, failure) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (!summaryFile) return

  const lines = [
    "## Governance gates",
    "",
    failure ? `**FAILED** at ${mdCell(failure.command)}` : "**PASSED**",
    "",
    "| Gate | Exit | Duration |",
    "| --- | --- | --- |",
    ...gateResults.map(
      (result) =>
        `| ${mdCell(result.command)} | ${result.exit_code ?? "spawn-error"} | ${result.duration_ms}ms |`
    ),
    "",
  ]

  try {
    appendFileSync(summaryFile, `${lines.join("\n")}\n`)
  } catch {
    // Best-effort only.
  }
}

function mdCell(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "'")
    .replace(/\r?\n/g, " ")
}

function isPlaywrightGate(parsed) {
  return parsed && playwrightGateScripts.has(parsed.scriptName)
}
