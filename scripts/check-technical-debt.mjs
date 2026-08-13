import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const result = spawnSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "*.ts",
    "*.tsx",
    "*.mts",
    "*.mjs",
    "*.sql",
    "*.yml",
    "*.yaml",
  ],
  { encoding: "utf8" }
)

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const files = result.stdout
  .split("\0")
  .filter(Boolean)
  .filter(existsSync)
  .filter((path) => path !== "scripts/check-technical-debt.mjs")

/**
 * Non-vacuity guard.
 *
 * The pathspec above is a filter, and this script reports a pass when the
 * filter keeps nothing: with the extensions replaced by nonsense it prints
 * "issue-linked across 0 source files" and exits 0. That is `bundle:check`
 * enforcing its budget on 0 of 150 routes, in another file.
 *
 * `*.mts` is deliberately absent: the repo has no .mts file today, so
 * requiring one would fail on a truth. Every other group is populated
 * (620 .ts, 530 .tsx, 438 .mjs, 173 .sql, 21 .yml/.yaml), so an empty group
 * means the pathspec — not the tree — changed.
 */
const REQUIRED_EXTENSION_GROUPS = [
  [".ts", /\.ts$/],
  [".tsx", /\.tsx$/],
  [".mjs", /\.mjs$/],
  [".sql", /\.sql$/],
  [".yml/.yaml", /\.ya?ml$/],
]

const emptyGroups = REQUIRED_EXTENSION_GROUPS.filter(
  ([, pattern]) => !files.some((path) => pattern.test(path))
).map(([label]) => label)

if (files.length === 0 || emptyGroups.length > 0) {
  console.error(
    `Technical-debt scan matched ${files.length} file(s) and found none for: ` +
      `${emptyGroups.join(", ") || "(none)"}. The git pathspec in this script no ` +
      "longer selects the sources it claims to scan, so the marker check is vacuous."
  )
  process.exit(1)
}

const untracked = []
const marker =
  /(?:\/\/|\/\*|^\s*\*|^\s*#|^\s*--)\s*\b(TODO|FIXME)\b(?!\((?:#\d+|[A-Z][A-Z0-9]+-\d+)\))/g

for (const path of files) {
  const lines = readFileSync(path, "utf8").split("\n")
  for (const [index, line] of lines.entries()) {
    if (marker.test(line)) {
      untracked.push(`${path}:${index + 1}: ${line.trim()}`)
    }
    marker.lastIndex = 0
  }
}

if (untracked.length > 0) {
  console.error(
    "Technical-debt markers must link to an issue, for example TODO(#123) or FIXME(OPS-123)."
  )
  console.error(untracked.join("\n"))
  process.exit(1)
}

console.log(
  `Technical-debt markers are issue-linked across ${files.length} source files.`
)
