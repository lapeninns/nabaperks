// Technical-debt scanner — counts TODO/FIXME/HACK/XXX markers in active source.
// Baseline is zero; the `--max` budget keeps it that way and fails CI if debt
// is introduced without being tracked. Raise `--max` deliberately, never to
// paper over a regression.
import { readFileSync } from "node:fs"
import { parseMaxArg, trackedFiles } from "./lib/tracked-files.mjs"

const PREFIXES = ["app/", "lib/", "components/", "scripts/", "supabase/"]
const MARKER = /\b(TODO|FIXME|HACK|XXX)\b/
const SELF = "scripts/scan-todos.mjs"
const max = parseMaxArg(process.argv, 0)

const findings = []

for (const file of trackedFiles(PREFIXES)) {
  if (file === SELF) continue
  if (!/\.(ts|tsx|mjs|js|sql)$/.test(file)) continue

  let source
  try {
    source = readFileSync(file, "utf8")
  } catch {
    continue
  }

  source.split("\n").forEach((line, index) => {
    if (MARKER.test(line)) {
      findings.push({ file, line: index + 1, text: line.trim().slice(0, 100) })
    }
  })
}

if (findings.length > 0) {
  console.log(`Found ${findings.length} debt marker(s) (budget ${max}):`)
  for (const { file, line, text } of findings) {
    console.log(`  ${file}:${line}  ${text}`)
  }
} else {
  console.log(`No TODO/FIXME/HACK/XXX debt markers found (budget ${max}).`)
}

if (findings.length > max) {
  console.error(
    `\nDebt markers (${findings.length}) exceed budget (${max}). Resolve them or raise --max intentionally.`
  )
  process.exit(1)
}
