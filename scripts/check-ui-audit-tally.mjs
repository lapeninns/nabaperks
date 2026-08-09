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
import { existsSync, readFileSync, readdirSync } from "node:fs"
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

/**
 * STATUS.md's own per-report heading. It drifted unchecked for a long time
 * ("61 done / 3 partial / 1 stale / 1 deferred / 1 open" when no 05 row has
 * ever carried [stale] or [defer]) because this script only validated the
 * COVERAGE.md and HANDOFF.md tables. A number a reader sees is a number worth
 * checking, wherever it lives.
 */
{
  const status = readFileSync(path.join(DIR, "STATUS.md"), "utf8")
  const heading = status.match(/^##\s*05-design-system\.md\s*—\s*([^\n]+)$/m)

  if (!heading) {
    problems.push("STATUS.md is missing its 05-design-system heading")
  } else {
    const counts = perReport["05"] ?? {
      "[x]": 0,
      "[~]": 0,
      "[stale]": 0,
      open: 0,
    }
    const nums = heading[1].match(/\d+/g)?.map(Number) ?? []
    const want = [counts["[x]"], counts["[~]"], counts.open, 67]

    if (want.some((n, i) => n !== nums[i])) {
      problems.push(
        `STATUS.md 05 heading reads ${nums}, parse says ` +
          `${counts["[x]"]} done / ${counts["[~]"]} partial / ${counts.open} open (of 67)`
      )
    }
  }
}

/**
 * Every source path the audit docs cite must still exist.
 *
 * These documents are read as evidence — "pinned by
 * `tests/contracts/x.test.mjs`", "fixed in `components/y.tsx`" — so a cited
 * path that has been renamed, or never existed, turns the record into a claim
 * nobody can check. Two were found by hand: a note citing
 * `tests/contracts/marketing-type-scale.test.mjs`, where the assertions were
 * real but lived in `marketing-chrome-tokens.test.mjs`, and two notes writing a
 * ROUTE (`/app/customers/loading.tsx`) where the file is
 * `app/app/customers/loading.tsx`.
 *
 * That is the "a test name is not a file" trap, which already cost this
 * campaign a dead submit button when a blocker was dismissed against the wrong
 * file.
 */
{
  const FILE_REF =
    /`((?:app|components|lib|tests|scripts|config|hooks)\/[A-Za-z0-9_\-./[\]]+\.(?:tsx?|mjs|json|css))`/g
  const cited = new Map()

  // Only the WORKING documents. The five audit reports and the master describe
  // the codebase as it was and propose files that do not exist yet — 04#74
  // recommends creating `components/admin/loading-skeletons.tsx` — so a missing
  // path there is the point, not a defect. STATUS/COVERAGE/HANDOFF/NEEDS-SIGNOFF
  // cite files as EVIDENCE, and that is what has to stay true.
  const evidenceDocs = readdirSync(DIR).filter(
    (name) => name.endsWith(".md") && !/^(00-master|0[1-5]-)/.test(name)
  )

  for (const file of evidenceDocs) {
    const text = readFileSync(path.join(DIR, file), "utf8")
    for (const match of text.matchAll(FILE_REF)) {
      if (!cited.has(match[1])) cited.set(match[1], new Set())
      cited.get(match[1]).add(file)
    }
  }

  if (cited.size < 20) {
    problems.push(
      `only ${cited.size} source paths cited across the audit docs — the ` +
        "reference check is probably matching nothing"
    )
  }

  for (const [target, files] of cited) {
    if (!existsSync(path.join(process.cwd(), target))) {
      problems.push(
        `${[...files].sort().join(", ")} cite ${target}, which does not exist`
      )
    }
  }
}

/**
 * The docs must not carry a merge conflict marker.
 *
 * A `> > > > > > > lane/merchant` sat inside HANDOFF's summary table for about
 * fifty commits. It survived because prettier reflows `>>>>>>>` into a
 * blockquote, so it stops looking like a conflict and starts looking like
 * prose — and because the table it corrupted was the one table this script
 * did not check. Both halves are closed here.
 */
{
  const MARKERS = [
    /^<{7}\s/m,
    /^={7}$/m,
    /^>{7}\s/m,
    /^(?:>\s){7}/m, // prettier-reflowed >>>>>>>
    /^(?:<\s){7}/m,
  ]
  for (const file of [
    "COVERAGE.md",
    "HANDOFF.md",
    "NEEDS-SIGNOFF.md",
    ...LANES,
  ]) {
    const text = readFileSync(path.join(DIR, file), "utf8")
    for (const marker of MARKERS) {
      const hit = text.match(marker)
      if (hit) {
        problems.push(
          `${file} contains an unresolved merge conflict marker: ${JSON.stringify(hit[0].slice(0, 40))}`
        )
        break
      }
    }
  }
}

/**
 * HANDOFF's "Where it landed" table is the first thing a reviewer reads, and
 * until now nothing checked it: the per-report loop above keys on report names
 * ("01 marketing"), and this table's rows are labelled Done/Partial/Stale/Open.
 * It was carrying counts fifty commits stale.
 */
{
  const text = readFileSync(path.join(DIR, "HANDOFF.md"), "utf8")
  const want = {
    "Findings tracked": 347,
    Done: tally["[x]"],
    Partial: tally["[~]"],
    Stale: tally["[stale]"],
    Open: tally.open,
  }
  for (const [label, expected] of Object.entries(want)) {
    const row = text.match(
      new RegExp(`^\\|\\s*${label}[^|]*\\|([^|]*)\\|`, "m")
    )
    if (!row) {
      problems.push(`HANDOFF.md "Where it landed" has no "${label}" row`)
      continue
    }
    const got = Number(row[1].replace(/[^\d]/g, ""))
    if (got !== expected) {
      problems.push(
        `HANDOFF.md "Where it landed" ${label} reads ${got}, parse says ${expected}`
      )
    }
  }
}

/**
 * HANDOFF enumerates the open findings by id. That list is what a reviewer
 * reads first, and it drifts silently: it said "all 13" and named 01#49 as
 * contract-blocked for several commits after 01#49 moved to `[stale]`, which
 * would have sent someone to renegotiate a contract over a defect that does not
 * exist in production.
 */
{
  const handoff = readFileSync(path.join(DIR, "HANDOFF.md"), "utf8")
  const heading = handoff.match(/^##\s*Open findings, all (\d+)\s*$/m)

  if (!heading) {
    problems.push("HANDOFF.md is missing its 'Open findings, all N' heading")
  } else {
    // The id list is the first non-empty block after the heading, and only
    // that block — the bullets below it categorise and legitimately mention
    // ids that are no longer open (03#46 lives in another status file).
    const after = handoff.slice(heading.index + heading[0].length)
    const firstBlock = after.split(/\n\s*\n/).find((block) => block.trim())
    const listed = (firstBlock ?? "").match(/\d\d#\d+/g) ?? []
    const actual = [...state.entries()]
      .filter(([, mark]) => mark === "[ ]" || mark === "[defer]")
      .map(([id]) => id)
      .sort()
    const unique = [...new Set(listed)].sort()

    if (Number(heading[1]) !== actual.length) {
      problems.push(
        `HANDOFF.md says "all ${heading[1]}" open, parse says ${actual.length}`
      )
    }
    if (unique.join(",") !== actual.join(",")) {
      problems.push(
        `HANDOFF.md open list is ${unique.join(", ") || "(empty)"}, ` +
          `parse says ${actual.join(", ")}`
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
