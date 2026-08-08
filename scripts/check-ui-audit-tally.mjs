#!/usr/bin/env node
/**
 * Verifies the UI-audit tally documents against the STATUS files.
 *
 * Written after COVERAGE.md sat at a stale 253/60/20/14 for most of the
 * campaign: the regex updating it required single spaces, prettier had aligned
 * the table into padded columns, and a substitution that matches nothing exits
 * exactly like one that works.
 *
 * Run: node scripts/check-ui-audit-tally.mjs
 */
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const DIR = path.join(process.cwd(), "docs/ui-audit")
const LANES = readdirSync(DIR).filter((f) => /^STATUS-.*\.md$/.test(f))
const RANK = { "[x]": 3, "[~]": 2, "[stale]": 2, "[defer]": 2, "[ ]": 0 }
const REPORTS = {
  "01 marketing": ["01", 69],
  "02 customer": ["02", 70],
  "03 merchant": ["03", 67],
  "04 admin": ["04", 74],
  "05 design system": ["05", 67],
}

/** A lane row marks status in column 1 or in columns 2-4, depending on file. */
function markOf(line) {
  const first = line.match(/^\|\s*(\[[x~ ]\]|\[stale\]|\[defer\])\s*\|/)
  if (first) return first[1]
  const cells = line.split("|").slice(1, 5)
  for (const cell of cells) {
    const m = cell.trim().match(/^(\[[x~ ]\]|\[stale\]|\[defer\])$/)
    if (m) return m[1]
  }
  return null
}

const state = new Map()
for (const file of [...LANES, "STATUS.md"]) {
  for (const line of readFileSync(path.join(DIR, file), "utf8").split("\n")) {
    if (!line.trimStart().startsWith("|")) continue
    const id = line.match(/\b(\d\d#\d+)\b/)
    const mark = markOf(line)
    if (!id || !mark) continue
    const prev = state.get(id[1])
    if (!prev || RANK[mark] > RANK[prev]) state.set(id[1], mark)
  }
}

const tally = { "[x]": 0, "[~]": 0, "[stale]": 0, open: 0 }
const perReport = {}
for (const [id, mark] of state) {
  const report = id.slice(0, 2)
  perReport[report] ??= { "[x]": 0, "[~]": 0, "[stale]": 0, open: 0 }
  const key = mark === "[ ]" || mark === "[defer]" ? "open" : mark
  tally[key] += 1
  perReport[report][key] += 1
}

const problems = []
if (state.size !== 347) {
  problems.push(`tracked ${state.size} findings, expected 347`)
}

for (const [label, [report, tracked]] of Object.entries(REPORTS)) {
  const counts = perReport[report] ?? {
    "[x]": 0,
    "[~]": 0,
    "[stale]": 0,
    open: 0,
  }
  const sum = counts["[x]"] + counts["[~]"] + counts["[stale]"] + counts.open
  if (sum !== tracked) {
    problems.push(`${label}: ${sum} rows, expected ${tracked}`)
  }
}

/** Every number in the summary tables must match the parse. */
for (const file of ["COVERAGE.md", "HANDOFF.md"]) {
  const text = readFileSync(path.join(DIR, file), "utf8")

  for (const [label, [report, tracked]] of Object.entries(REPORTS)) {
    const row = text.match(
      new RegExp(`\\|\\s*${label}\\s*\\|([^\\n]*)\\|`, "i")
    )
    if (!row) continue
    const nums = row[1].match(/\d+/g)?.map(Number) ?? []
    const counts = perReport[report]
    const want = [
      tracked,
      counts["[x]"],
      counts["[~]"],
      counts["[stale]"],
      counts.open,
    ]
    if (nums.length >= 5 && want.some((n, i) => n !== nums[i])) {
      problems.push(
        `${file} "${label}" row reads ${nums.slice(0, 5)}, parse says ${want}`
      )
    }
  }

  const total = text.match(/\|\s*\*\*Total\*\*\s*\|([^\n]*)\|/)
  if (total) {
    const nums = total[1].match(/\d+/g)?.map(Number) ?? []
    const want = [347, tally["[x]"], tally["[~]"], tally["[stale]"], tally.open]
    if (want.some((n, i) => n !== nums[i])) {
      problems.push(
        `${file} Total row reads ${nums.slice(0, 5)}, parse says ${want}`
      )
    }
  }
}

if (problems.length > 0) {
  console.error("✗ UI-audit tally is out of sync:\n")
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

console.log(
  `✓ UI-audit tally in sync: ${tally["[x]"]} done / ${tally["[~]"]} partial / ` +
    `${tally["[stale]"]} stale / ${tally.open} open of ${state.size}`
)
