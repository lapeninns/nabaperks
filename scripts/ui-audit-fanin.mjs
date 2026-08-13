#!/usr/bin/env node
/**
 * UI-audit fan-in helper.
 *
 * Merging lanes into feat/ui-redesign-audit-fixes has corrupted the shared docs
 * in every round so far, always the same three ways:
 *
 *   1. "take both" on a conflicted table leaves TWO tables, and the checker
 *      reads whichever it finds first;
 *   2. lanes append NEEDS-SIGNOFF sections numbered from their own base, so two
 *      lanes both write "## 33." and the numbering forks;
 *   3. a conflict marker survives because prettier reflows `>>>>>>>` into a
 *      blockquote, which stops looking like a conflict.
 *
 * This does the mechanical part deterministically: strip markers, renumber the
 * sections in order, and REBUILD the tally tables from the STATUS files rather
 * than trusting either side of a merge. It never invents a number — every count
 * comes from parsing the per-finding rows, which is the same source
 * check-ui-audit-tally.mjs verifies against.
 *
 * It deliberately does NOT resolve prose conflicts. Two lanes writing different
 * paragraphs about the same finding is a judgement call, and this exits
 * non-zero listing those files so a human or the integrator reads them.
 *
 *   node scripts/ui-audit-fanin.mjs           # report only
 *   node scripts/ui-audit-fanin.mjs --write   # apply
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import path from "node:path"

const DIR = path.join(process.cwd(), "docs/ui-audit")
const WRITE = process.argv.includes("--write")
const REPORTS = {
  "01 marketing": ["01", 69],
  "02 customer": ["02", 70],
  "03 merchant": ["03", 67],
  "04 admin": ["04", 74],
  "05 design system": ["05", 67],
}
const RANK = { "[x]": 4, "[~]": 3, "[stale]": 2, "[defer]": 1, "[ ]": 0 }
const MARKERS = [/^<{7}\s.*$/gm, /^={7}$/gm, /^>{7}\s.*$/gm, /^(?:>\s){7}.*$/gm]

const docs = readdirSync(DIR).filter((f) => f.endsWith(".md"))
const notes = []
const rewritten = []

/** Per-finding state, highest-ranked mark wins — the checker's own rule. */
function parseState() {
  const state = new Map()
  for (const file of docs.filter((f) => /^STATUS/.test(f))) {
    for (const line of readFileSync(path.join(DIR, file), "utf8").split("\n")) {
      const id = line.match(/\b(\d\d#\d+)\b/)
      const mark = line.match(/\[(x|~| |stale|defer)\]/)
      if (!id || !mark) continue
      const key = `[${mark[1]}]`
      const prev = state.get(id[1])
      if (!prev || RANK[key] > RANK[prev]) state.set(id[1], key)
    }
  }
  return state
}

const state = parseState()
const per = {}
for (const [id, mark] of state) {
  const r = id.slice(0, 2)
  per[r] ??= { "[x]": 0, "[~]": 0, "[stale]": 0, open: 0 }
  per[r][mark === "[ ]" || mark === "[defer]" ? "open" : mark] += 1
}

for (const file of docs) {
  const original = readFileSync(path.join(DIR, file), "utf8")
  let text = original

  for (const marker of MARKERS) {
    const hits = text.match(marker)
    if (hits) {
      notes.push(`${file}: removed ${hits.length} conflict marker line(s)`)
      text = text.replace(marker, "")
    }
  }

  if (file === "NEEDS-SIGNOFF.md") {
    let n = 0
    const before = [...text.matchAll(/^## (\d+)\. /gm)].map((m) => m[1])
    text = text.replace(/^## (\d+)\. /gm, () => `## ${++n}. `)
    const dupes = before.filter((v, i) => before.indexOf(v) !== i)
    if (dupes.length) {
      notes.push(
        `${file}: renumbered ${n} sections (duplicate numbers were ${[...new Set(dupes)].join(", ")})`
      )
    }
  }

  const rows = []
  let total = { tracked: 0, "[x]": 0, "[~]": 0, "[stale]": 0, open: 0 }
  for (const [label, [report, tracked]] of Object.entries(REPORTS)) {
    const c = per[report] ?? { "[x]": 0, "[~]": 0, "[stale]": 0, open: 0 }
    total = {
      tracked: total.tracked + tracked,
      "[x]": total["[x]"] + c["[x]"],
      "[~]": total["[~]"] + c["[~]"],
      "[stale]": total["[stale]"] + c["[stale]"],
      open: total.open + c.open,
    }
    rows.push(
      `| ${label.padEnd(16)} | ${String(tracked).padStart(7)} | ${String(c["[x]"]).padStart(7)} | ${String(c["[~]"]).padStart(7)} | ${String(c["[stale]"]).padStart(6)} | ${String(c.open).padStart(6)} |`
    )
  }
  rows.push(
    `| **Total**        | **${total.tracked}** | **${total["[x]"]}** |  **${total["[~]"]}** | **${total["[stale]"]}** | **${total.open}** |`
  )

  const lines = text.split("\n")
  const idx = lines
    .map((l, i) => (/^\|\s*(0\d [a-z]|\*\*Total)/.test(l) ? i : -1))
    .filter((i) => i >= 0)
  if (idx.length) {
    const duplicated = idx.length > rows.length
    text = [
      ...lines.slice(0, idx[0]),
      ...rows,
      ...lines.slice(idx[idx.length - 1] + 1),
    ].join("\n")
    notes.push(
      `${file}: rebuilt the tally table from the STATUS rows${duplicated ? ` (it had ${idx.length} rows for ${rows.length} slots — duplicated by a merge)` : ""}`
    )
  }

  if (text !== original && WRITE) {
    writeFileSync(path.join(DIR, file), text)
    rewritten.push(file)
  }
}

// Hand the rewritten files to prettier. Without this the rebuilt tally table is
// padded by this script and re-padded by prettier, so the two disagree forever:
// every run leaves a whitespace-only diff, and a whitespace-only diff is still
// enough to abort `git merge` with "local changes would be overwritten". The
// formatter owns formatting; this script owns the numbers.
if (WRITE && rewritten.length) {
  try {
    execFileSync(
      "pnpm",
      ["exec", "prettier", "--write", ...rewritten.map((f) => path.join("docs/ui-audit", f))],
      { stdio: "ignore" }
    )
    notes.push(`formatted ${rewritten.length} rewritten file(s) with prettier`)
  } catch {
    notes.push("WARNING: prettier failed; expect a whitespace-only diff")
  }
}

const stillConflicted = docs.filter((f) =>
  /^(<{7}|={7}|>{7})/m.test(readFileSync(path.join(DIR, f), "utf8"))
)

console.log(
  notes.length ? notes.map((n) => `  ${n}`).join("\n") : "  nothing to do"
)
console.log(
  `\n  parsed ${state.size} findings: ${per["01"] ? "" : "(no STATUS rows found!) "}` +
    Object.entries(per)
      .map(([r, c]) => `${r}=${c["[x]"]}/${c["[~]"]}/${c["[stale]"]}/${c.open}`)
      .join("  ")
)
if (!WRITE) console.log("\n  dry run — pass --write to apply")

if (state.size === 0) {
  console.error("\n✗ parsed zero findings; the STATUS format must have changed")
  process.exit(1)
}
if (stillConflicted.length) {
  console.error(
    `\n✗ unresolved prose conflicts in: ${stillConflicted.join(", ")}`
  )
  process.exit(1)
}
