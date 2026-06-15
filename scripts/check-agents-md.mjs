// AGENTS.md validation — keeps the agent governance index trustworthy:
//   1. required sections are present,
//   2. the managed Next.js rules block is intact,
//   3. every local markdown link resolves to a file that exists.
// Runs over AGENTS.md and CLAUDE.md (both are agent-facing). Fails CI on drift
// so a renamed doc never leaves a dangling pointer for the next agent.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"

const failures = []

const REQUIRED_SECTIONS = [
  "## Stack",
  "## Spec pack and global context",
  "## Related Docs",
  "## Next.js",
]
const MANAGED_MARKERS = [
  "<!-- BEGIN:nextjs-agent-rules -->",
  "<!-- END:nextjs-agent-rules -->",
]

if (!existsSync("AGENTS.md")) {
  failures.push("AGENTS.md is missing")
} else {
  const agents = readFileSync("AGENTS.md", "utf8")
  for (const section of REQUIRED_SECTIONS) {
    if (!agents.includes(section))
      failures.push(`AGENTS.md missing section: ${section}`)
  }
  for (const marker of MANAGED_MARKERS) {
    if (!agents.includes(marker))
      failures.push(`AGENTS.md missing managed marker: ${marker}`)
  }
}

const LINK = /\[[^\]]+\]\(([^)]+)\)/g

for (const doc of ["AGENTS.md", "CLAUDE.md"]) {
  if (!existsSync(doc)) continue
  const source = readFileSync(doc, "utf8")
  const base = dirname(doc)

  for (const match of source.matchAll(LINK)) {
    const target = match[1].trim()
    if (/^(https?:|mailto:|#)/.test(target)) continue

    const [path] = target.split("#")
    if (!path) continue

    const resolved = normalize(join(base, path))
    if (!existsSync(resolved)) {
      failures.push(`${doc} links to missing file: ${target}`)
    }
  }
}

if (failures.length > 0) {
  console.error("AGENTS.md validation failed:")
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log("AGENTS.md validation passed (sections, managed block, and links).")
