// N+1 / sequential-database-access guard for Supabase query paths.
//
// Flags awaited Supabase reads/writes (`.from(...)`, `.rpc(...)`) that execute
// inside a `for` / `for await` / `while` loop body — the classic N+1 shape where
// each iteration round-trips the database sequentially. Parallel fan-out via
// `Promise.all(items.map(...))` is intentionally NOT flagged. The check is a
// heuristic brace-depth scan, so it ratchets against a budget rather than
// claiming perfect precision.
import { readFileSync } from "node:fs"
import { parseMaxArg, trackedFiles } from "./lib/tracked-files.mjs"

const PREFIXES = ["app/", "lib/"]
const LOOP_OPEN = /\b(for\s+await\s*\(|for\s*\(|while\s*\()/
const DB_CALL = /await[\s\S]*?\.(from|rpc)\(|\.(from|rpc)\([\s\S]*?await/
const SIMPLE_DB = /\.(from|rpc)\(/
const max = parseMaxArg(process.argv, 0)

const findings = []

for (const file of trackedFiles(PREFIXES)) {
  if (!/\.(ts|tsx)$/.test(file)) continue

  const lines = readFileSync(file, "utf8").split("\n")
  let depth = 0
  const loopStack = []

  lines.forEach((line, index) => {
    const opensLoop = LOOP_OPEN.test(line)

    if (opensLoop) loopStack.push(depth)

    if (
      loopStack.length > 0 &&
      line.includes("await") &&
      SIMPLE_DB.test(line) &&
      DB_CALL.test(line)
    ) {
      findings.push({ file, line: index + 1, text: line.trim().slice(0, 100) })
    }

    for (const char of line) {
      if (char === "{") depth += 1
      if (char === "}") {
        depth -= 1
        while (
          loopStack.length > 0 &&
          loopStack[loopStack.length - 1] >= depth
        ) {
          loopStack.pop()
        }
      }
    }
  })
}

if (findings.length > 0) {
  console.log(`Potential N+1 database access in loops (budget ${max}):`)
  for (const { file, line, text } of findings) {
    console.log(`  ${file}:${line}  ${text}`)
  }
} else {
  console.log(
    `No sequential in-loop Supabase queries detected (budget ${max}).`
  )
}

if (findings.length > max) {
  console.error(
    `\n${findings.length} potential N+1 site(s) exceed budget (${max}). Batch the query or fan out with Promise.all.`
  )
  process.exit(1)
}
