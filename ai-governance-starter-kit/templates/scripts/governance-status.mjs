#!/usr/bin/env node
// Status station: a read-only portfolio dashboard over the Micro-Spec
// factory. One row per non-terminal spec (lifecycle state, risk, review
// age, latest recorded evidence, waivers), then an attention section:
// implemented/verified specs ordered by how long they have awaited the next
// lifecycle step, and every failure the full checker currently reports.
// Report-only by design — it always exits 0 (enforcement is governance:check's
// job); exit 2 is reserved for usage errors.
//
// usage:
//   node scripts/governance-status.mjs [--all] [--json]
//
// --all lists terminal (closed/superseded) specs instead of a count line.

import { GRANDFATHER_GATE, readLedger } from "./governance-evidence.mjs"
import { validateGovernance } from "./governance-rules.mjs"

const STATUS_ORDER = ["active", "implemented", "verified", "draft", "closed", "superseded"]
const NEXT_STEP = {
  implemented: "verification (governance:advance --to verified)",
  verified: "closure (governance:advance --to closed)",
}

const root = process.cwd()
const args = process.argv.slice(2)
const unknown = args.filter((arg) => !["--all", "--json"].includes(arg))
if (unknown.length > 0) {
  console.error(`governance-status: unknown flag "${unknown[0]}"`)
  console.error("usage: node scripts/governance-status.mjs [--all] [--json]")
  process.exit(2)
}
const showAll = args.includes("--all")
const asJson = args.includes("--json")

// Blast radius is about the working tree, not the portfolio — skipped here.
const validation = validateGovernance(root, { changedFiles: [] })
const now = new Date()

const rows = validation.specs
  .filter((spec) => !(spec.parseErrors?.length > 0))
  .map((spec) => describeSpec(spec))
  .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.id.localeCompare(b.id))

const terminal = rows.filter((row) => row.terminal)
const visible = showAll ? rows : rows.filter((row) => !row.terminal)

const attention = rows
  .filter((row) => row.status === "implemented" || row.status === "verified")
  .sort((a, b) => (b.statusAgeDays ?? -1) - (a.statusAgeDays ?? -1))
  .map((row) => ({
    id: row.id,
    status: row.status,
    forDays: row.statusAgeDays,
    awaiting: NEXT_STEP[row.status],
  }))

if (asJson) {
  console.log(JSON.stringify({ rows, attention, failures: validation.failures }, null, 2))
  process.exit(0)
}

printTable([
  ["SPEC", "STATUS", "RISK", "REVIEWED", "LATEST RUN", "WAIVERS"],
  ...visible.map((row) => [
    row.id,
    row.status,
    row.risk ?? "?",
    formatAge(row.reviewedAgeDays),
    row.run,
    row.waivers > 0 ? String(row.waivers) : "-",
  ]),
])

if (!showAll && terminal.length > 0) {
  const counts = {}
  for (const row of terminal) counts[row.status] = (counts[row.status] ?? 0) + 1
  const summary = Object.entries(counts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ")
  console.log(`\n(${summary} — pass --all to list terminal specs)`)
}

if (attention.length > 0) {
  console.log("\nAttention — awaiting the next lifecycle step:")
  for (const entry of attention) {
    console.log(
      `- ${entry.id}: ${entry.status} for ${formatAge(entry.forDays)}, awaiting ${entry.awaiting}`
    )
  }
}

if (validation.failures.length > 0) {
  console.log(`\nChecker failures (${validation.failures.length}) — governance:check is red:`)
  for (const failure of validation.failures) console.log(`- ${failure}`)
} else {
  console.log("\nChecker: green.")
}

function describeSpec(spec) {
  const meta = spec.metadata
  const ledger = meta.spec_id ? readLedger(root, meta.spec_id) : null
  const usable = ledger && !ledger.parseError ? ledger : null
  const latest = (usable?.runs ?? []).at(-1)
  const lastTransition = (usable?.transitions ?? []).at(-1)
  const isStub =
    !latest &&
    (usable?.manual_attestations ?? []).some((entry) => entry.gate === GRANDFATHER_GATE)

  let run = "none"
  if (isStub) run = "stub (grandfathered)"
  else if (latest) {
    const sha = latest.git_sha ? ` @${String(latest.git_sha).slice(0, 8)}` : ""
    run = `${latest.all_passed ? "green" : "RED"} ${formatAge(ageDays(latest.timestamp))}${sha}`
  }

  return {
    id: meta.spec_id ?? spec.file,
    status: meta.status,
    risk: meta.risk_class,
    terminal: meta.status === "closed" || meta.status === "superseded",
    reviewedAgeDays: ageDays(meta.last_reviewed),
    run,
    statusAgeDays: lastTransition ? ageDays(lastTransition.at) : null,
    waivers: Array.isArray(meta.approved_exceptions) ? meta.approved_exceptions.length : 0,
  }
}

function statusRank(status) {
  const rank = STATUS_ORDER.indexOf(status)
  return rank === -1 ? STATUS_ORDER.length : rank
}

function ageDays(value) {
  const parsed = Date.parse(value ?? "")
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000))
}

function formatAge(days) {
  if (days === null || days === undefined) return "?"
  return `${days}d`
}

function printTable(cells) {
  const widths = cells[0].map((_, column) =>
    Math.max(...cells.map((row) => String(row[column]).length))
  )
  for (const row of cells) {
    console.log(
      row.map((cell, column) => String(cell).padEnd(widths[column])).join("  ").trimEnd()
    )
  }
}
