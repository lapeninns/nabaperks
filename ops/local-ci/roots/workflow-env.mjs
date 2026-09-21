#!/usr/bin/env node
// Prints the CI workflow's synthetic env (root `env:` block plus the fast
// job's fixtures and the browser jobs' switches) as bash exports, so the
// local roots run with exactly the values hosted CI uses. Never real secrets.
import { readFileSync } from "node:fs"

const workflow = readFileSync(process.argv[2], "utf8")
// Root `env:` block: from the first top-level `env:` to the next top-level key.
const rootBlock = workflow.match(/^env:\n([\s\S]*?)^[a-z]/m)?.[1] ?? ""
const fastBlock =
  workflow.match(
    /^  fast:\n[\s\S]*?\n    env:\n([\s\S]*?)\n    steps:/m
  )?.[1] ?? ""
const entries = new Map()
for (const block of [rootBlock, fastBlock]) {
  for (const line of block.split("\n")) {
    const match = /^\s+([A-Z_]+):\s*(.*)$/.exec(line)
    if (!match || match[2].includes("${{")) continue
    entries.set(match[1], match[2].replace(/^"(.*)"$/, "$1"))
  }
}
const hook = workflow.match(
  /SUPABASE_SEND_EMAIL_HOOK_SECRET=v1,%s_%s\\n' whsec (\S+)/
)
if (hook) entries.set("SUPABASE_SEND_EMAIL_HOOK_SECRET", `v1,whsec_${hook[1]}`)
entries.set("CI", "1")
for (const [key, value] of entries) {
  console.log(`export ${key}='${value.replace(/'/g, "'\\''")}'`)
}
