// Client bundle-size guard. Run after `pnpm build`: it sums the raw bytes of the
// emitted client JS chunks and fails if the total exceeds the budget, so a heavy
// dependency or accidental client-side import is caught in CI before it ships.
// Baseline ~1.6 MB; budget set with headroom. For a per-chunk visual breakdown
// run `pnpm analyze`.
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const CHUNKS_DIR = ".next/static/chunks"
const BUDGET_PREFIX = "--budget-kb="
const budgetArg = process.argv.find((value) => value.startsWith(BUDGET_PREFIX))
const budgetKb = budgetArg
  ? Number.parseInt(budgetArg.slice(BUDGET_PREFIX.length), 10)
  : 2500

function jsFiles(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...jsFiles(path))
    else if (entry.name.endsWith(".js"))
      out.push({ path, bytes: statSync(path).size })
  }
  return out
}

const files = jsFiles(CHUNKS_DIR)

if (files.length === 0) {
  console.error(
    `No client chunks found in ${CHUNKS_DIR}. Run \`pnpm build\` first.`
  )
  process.exit(1)
}

const totalKb = files.reduce((sum, file) => sum + file.bytes, 0) / 1024
files.sort((a, b) => b.bytes - a.bytes)

console.log(
  `Client bundle: ${totalKb.toFixed(0)} KB across ${files.length} chunks (budget ${budgetKb} KB)`
)
console.log("Largest chunks:")
for (const { path, bytes } of files.slice(0, 8)) {
  console.log(`  ${(bytes / 1024).toFixed(0).padStart(6)} KB  ${path}`)
}

if (totalKb > budgetKb) {
  console.error(
    `\nClient bundle (${totalKb.toFixed(0)} KB) exceeds budget (${budgetKb} KB). Trim a dependency or move code server-side.`
  )
  process.exit(1)
}
