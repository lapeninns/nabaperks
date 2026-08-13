#!/usr/bin/env node
/**
 * Formatting ratchet.
 *
 * `pnpm format` exists and nothing checked its result, so formatting drifted
 * for free: 248 tracked files fail `prettier --check` at the commit that added
 * this script, including 114 tests and four files in `docs/ui-audit` that the
 * audit's own scripts parse. A gate nobody can run is not a standard.
 *
 * Switching `prettier --check` on repo-wide today would fail the build on 248
 * pre-existing files, which is exactly why it was never added. So this
 * ratchets rather than gates, on the model of `check-dead-exports.mjs`: the
 * 248 are recorded in a baseline and tolerated, anything NEW fails, and a
 * baselined file that has since been formatted must be pruned — so the number
 * can only travel one way.
 *
 * The baseline is deliberately NOT an ignore list. Run `pnpm format` over a
 * file you are already touching, then `pnpm format:baseline`, and the file
 * leaves the list for good.
 *
 * Run: node scripts/check-format.mjs [--write]   (pnpm format:check)
 */
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const BASELINE = "config/format-baseline.json"

/**
 * The extensions prettier owns here. `.md` is included on purpose: the audit
 * documents are hand-edited constantly and are parsed by
 * `check-ui-audit-tally.mjs`, and prettier reflowing a table is how a merge
 * conflict marker once disguised itself as a blockquote for fifty commits.
 */
const PATTERNS = ["*.ts", "*.tsx", "*.mts", "*.mjs", "*.css", "*.json", "*.md"]

/** Non-vacuity floor: 2,000+ files match today. */
const MIN_FILES = 1000

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z", "--", ...PATTERNS], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  return out.split("\0").filter(Boolean)
}

const files = trackedFiles()

if (files.length < MIN_FILES) {
  console.error(
    `Only ${files.length} tracked file(s) matched ${PATTERNS.join(", ")}, floor ` +
      `${MIN_FILES}. The pathspec no longer selects this repo, so a formatting ` +
      "pass here would mean nothing."
  )
  process.exit(1)
}

/**
 * prettier --check prints one `[warn] <path>` line per unformatted file and
 * exits 1. `--list-different` is not used: the same information, but --check's
 * output shape is what a reader sees when this fails.
 */
const result = spawnSync(
  "pnpm",
  ["exec", "prettier", "--check", "--no-color", ...files],
  { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
)

if (result.error) {
  console.error(`prettier could not be run: ${result.error.message}`)
  process.exit(1)
}

const unformatted = `${result.stdout}\n${result.stderr}`
  .split("\n")
  .filter((line) => line.startsWith("[warn] "))
  .map((line) => line.slice("[warn] ".length).trim())
  .filter((line) => line && !line.startsWith("Code style issues"))
  .sort()

if (result.status !== 0 && unformatted.length === 0) {
  console.error(
    "prettier exited non-zero without naming a file. Its output shape has " +
      `changed and this ratchet cannot read it:\n${result.stdout}${result.stderr}`
  )
  process.exit(1)
}

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify(unformatted, null, 2)}\n`)
  console.log(`Wrote ${unformatted.length} entries to ${BASELINE}`)
  process.exit(0)
}

const baseline = new Set(JSON.parse(readFileSync(BASELINE, "utf8")))
const added = unformatted.filter((file) => !baseline.has(file))
const fixed = [...baseline].filter((file) => !unformatted.includes(file)).sort()

if (added.length) {
  console.error(`\u2717 ${added.length} newly unformatted file(s):\n`)
  for (const file of added) console.error(`    ${file}`)
  console.error("\n    pnpm format   (or prettier --write on just these files)")
  process.exit(1)
}

if (fixed.length) {
  console.error(
    `\u2717 ${fixed.length} baselined file(s) are formatted now. Prune the ` +
      "baseline so it cannot drift back:\n"
  )
  for (const file of fixed) console.error(`    ${file}`)
  console.error("\n    pnpm format:baseline")
  process.exit(1)
}

console.log(
  `\u2713 Formatting held: ${files.length - baseline.size} of ${files.length} tracked ` +
    `file(s) are prettier-clean, ${baseline.size} baselined and shrinking only`
)
