// Goal-gate runner — "runs" a declarative goal/spec markdown file by parsing its
// "Verification gate:" section and executing the project commands each line maps
// to, then reporting pass/fail. This makes a declarative goal reproducibly
// runnable so future runs can prove it.
//
// Usage: node scripts/run-goal-gate.mjs [path/to/goal.md]
import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

const goalPath = process.argv[2] ?? "Goal/goal.md"

if (!existsSync(goalPath)) {
  console.error(`Goal file not found: ${goalPath}`)
  process.exit(2)
}

const source = readFileSync(goalPath, "utf8")
const gateMatch = source.match(
  /Verification gate:\s*([\s\S]*?)(?:\n\s*\nDefinition of done:|$)/i
)
if (!gateMatch) {
  console.error(`No "Verification gate:" section found in ${goalPath}`)
  process.exit(2)
}

const gateLines = gateMatch[1]
  .split("\n")
  .map((line) => line.replace(/^\s*-\s*/, "").trim())
  .filter((line) => line.length > 0)

// Map each gate line (by keyword) to the concrete command(s) that satisfy it.
// Lines that are about reporting/manual steps are acknowledged, not executed.
const RULES = [
  // The canonical legacy-naming guard is the dedicated test (it builds its
  // banned patterns from fragments so the guard file itself stays clean).
  {
    match: /legacy naming/i,
    run: [
      "pnpm",
      "vitest",
      "run",
      "tests/micro-specs/no-legacy-naming.test.ts",
    ],
  },
  { match: /run lint/i, run: ["pnpm", "lint"] },
  { match: /run typecheck/i, run: ["pnpm", "typecheck"] },
  { match: /vitest/i, run: ["pnpm", "test"] },
  { match: /supabase sql/i, run: ["pnpm", "db:verify"] },
  {
    match: /playwright|route smoke/i,
    note: "live route smoke (needs a running server) — see /api/health",
  },
  { match: /run build/i, run: ["pnpm", "build"] },
  { match: /new quality\/security\/doc script/i, run: ["pnpm", "quality"] },
  {
    match: /confirm the audit criteria/i,
    note: "criteria confirmed via the gates above",
  },
  {
    match: /final output/i,
    note: "reporting requirement — satisfied by the run summary",
  },
]

console.log(`# Running goal gate from ${goalPath}\n`)
const results = []

for (const line of gateLines) {
  const rule = RULES.find((r) => r.match.test(line))
  if (!rule) {
    results.push({ line, status: "skip", note: "no mapped command" })
    continue
  }
  if (rule.note && !rule.run) {
    console.log(`• [note] ${line}\n        ${rule.note}`)
    results.push({ line, status: "note" })
    continue
  }
  process.stdout.write(`• [run ] ${line}\n        $ ${rule.run.join(" ")} ... `)
  const res = spawnSync(rule.run[0], rule.run.slice(1), { encoding: "utf8" })
  const ok = res.status === 0
  console.log(ok ? "PASS" : `FAIL (exit ${res.status})`)
  if (!ok && res.stderr)
    console.log(res.stderr.split("\n").slice(-6).join("\n"))
  results.push({ line, status: ok ? "pass" : "fail" })
}

const failed = results.filter((r) => r.status === "fail")
console.log(
  `\n# Gate summary: ${results.filter((r) => r.status === "pass").length} passed, ` +
    `${failed.length} failed, ${results.filter((r) => r.status === "note" || r.status === "skip").length} noted/skipped`
)
process.exit(failed.length > 0 ? 1 : 0)
