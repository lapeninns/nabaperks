#!/usr/bin/env node
/**
 * Dead-export ratchet.
 *
 * `pnpm deadcode:check` runs knip with `--include files,dependencies,unresolved`,
 * so it cannot report an unused EXPORT at all. That is not an oversight to
 * "just fix": switching the rule on today fails the build with 233 pre-existing
 * unused exports, which is why it was scoped out in the first place.
 *
 * So this ratchets instead of gating. The 233 are recorded in a baseline and
 * tolerated; anything NEW fails. Deleting a baselined export is encouraged and
 * the script tells you to prune the baseline when you do, so the number can only
 * travel one way.
 *
 * Not a substitute for judgement: an export can be legitimately unimported and
 * still wanted (a public API, a documented helper). Add those to `ALLOWED`
 * with a reason rather than leaving them to drift in the baseline.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const BASELINE = "config/dead-exports-baseline.json"
const ALLOWED = new Set([])

function currentFindings() {
  const raw = execFileSync(
    "pnpm",
    [
      "exec",
      "knip",
      "--include",
      "exports",
      "--no-progress",
      "--reporter",
      "json",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
  const parsed = JSON.parse(raw)
  const found = new Set()
  for (const issue of parsed.issues ?? []) {
    for (const entry of issue.exports ?? []) {
      const key = `${issue.file}#${entry.name}`
      if (!ALLOWED.has(key)) found.add(key)
    }
  }
  return found
}

const found = currentFindings()

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify([...found].sort(), null, 2)}\n`)
  console.log(`Wrote ${found.size} entries to ${BASELINE}`)
  process.exit(0)
}

const baseline = new Set(JSON.parse(readFileSync(BASELINE, "utf8")))
const added = [...found].filter((key) => !baseline.has(key)).sort()
const removed = [...baseline].filter((key) => !found.has(key)).sort()

if (added.length) {
  console.error(`✗ ${added.length} new unused export(s):\n`)
  for (const key of added) console.error(`    ${key}`)
  console.error(
    "\nEither use it, delete it, or — if it is deliberately part of a public" +
      "\nsurface — add it to ALLOWED in scripts/check-dead-exports.mjs with a reason."
  )
  process.exit(1)
}

if (removed.length) {
  console.error(
    `✗ ${removed.length} baselined export(s) are no longer dead. Prune the` +
      ` baseline so it cannot drift:\n`
  )
  for (const key of removed) console.error(`    ${key}`)
  console.error("\n    pnpm deadexports:baseline")
  process.exit(1)
}

console.log(`✓ No new dead exports (${baseline.size} baselined)`)
