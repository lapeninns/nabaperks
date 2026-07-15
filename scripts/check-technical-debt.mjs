import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

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
  .filter((path) => path !== "scripts/check-technical-debt.mjs")
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
