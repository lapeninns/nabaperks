// File-naming convention guard — every TypeScript source file under app/, lib/,
// and components/ must be kebab-case. Next.js special files, route-group dirs,
// and dynamic `[segment]` folders are allowed by construction; vendored shadcn
// primitives under components/ui are owned upstream and skipped. Baseline is
// zero violations; new non-kebab files fail CI.
import { basename } from "node:path"
import { parseMaxArg, trackedFiles } from "./lib/tracked-files.mjs"

const PREFIXES = ["app/", "lib/", "components/"]
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*(\.(test|spec|config|client|node|edge))*$/
const max = parseMaxArg(process.argv, 0)

const violations = []

for (const file of trackedFiles(PREFIXES)) {
  if (!/\.(ts|tsx)$/.test(file)) continue
  if (file.startsWith("components/ui/")) continue
  if (file.endsWith(".d.ts")) continue

  const name = basename(file).replace(/\.(tsx|ts)$/, "")

  // `[dynamic]`, `[...catchAll]`, and `[[...optional]]` route segments live in
  // directory names, never file names; a file name is never bracketed.
  if (!KEBAB.test(name)) {
    violations.push(file)
  }
}

if (violations.length > 0) {
  console.log(`Non-kebab-case source files (budget ${max}):`)
  for (const file of violations) console.log(`  ${file}`)
} else {
  console.log(`All source files follow kebab-case naming (budget ${max}).`)
}

if (violations.length > max) {
  console.error(
    `\n${violations.length} naming violation(s) exceed budget (${max}). Rename to kebab-case.`
  )
  process.exit(1)
}
