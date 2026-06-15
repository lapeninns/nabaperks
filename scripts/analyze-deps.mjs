// Heavy-dependency analysis — reports the on-disk size of each production
// dependency's installed tree so reviewers can spot weight before it ships in a
// bundle. Pair with `pnpm analyze` (@next/bundle-analyzer) for the actual
// client/server bundle breakdown. Pass `--budget-kb=N` to fail when any single
// production dependency tree exceeds N KB.
import { readFileSync, statSync, readdirSync } from "node:fs"
import { join } from "node:path"

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
const deps = Object.keys(pkg.dependencies ?? {})

const budgetArg = process.argv.find((value) => value.startsWith("--budget-kb="))
const budgetKb = budgetArg ? Number.parseInt(budgetArg.slice(12), 10) : Infinity

function dirSize(dir) {
  let total = 0
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      total += dirSize(path)
    } else {
      try {
        total += statSync(path).size
      } catch {
        /* ignore unreadable file */
      }
    }
  }
  return total
}

const sizes = deps
  .map((name) => ({ name, bytes: dirSize(join("node_modules", name)) }))
  .sort((a, b) => b.bytes - a.bytes)

const totalBytes = sizes.reduce((sum, dep) => sum + dep.bytes, 0)

console.log("Production dependency footprint (installed, on disk):\n")
for (const { name, bytes } of sizes) {
  const kb = (bytes / 1024).toFixed(0).padStart(7)
  const flag = bytes / 1024 > budgetKb ? "  ⚠ over budget" : ""
  console.log(`  ${kb} KB  ${name}${flag}`)
}
console.log(
  `\n  ${(totalBytes / 1024 / 1024).toFixed(1)} MB total across ${deps.length} prod deps`
)

const overBudget = sizes.filter(({ bytes }) => bytes / 1024 > budgetKb)
if (overBudget.length > 0) {
  console.error(
    `\n${overBudget.length} dependency tree(s) exceed ${budgetKb} KB: ${overBudget
      .map((dep) => dep.name)
      .join(", ")}`
  )
  process.exit(1)
}
