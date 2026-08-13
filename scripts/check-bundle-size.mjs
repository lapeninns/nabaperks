#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = process.cwd()
const nextDir = join(root, ".next")
const budgetPath = join(root, "config/bundle-budget.json")

if (!existsSync(nextDir)) {
  fail(
    "Missing .next build output. Run `pnpm build` before `pnpm bundle:check`."
  )
}

const budget = JSON.parse(readFileSync(budgetPath, "utf8"))
const buildManifest = readJsonIfExists(join(nextDir, "build-manifest.json"))
const appEntryChunks = readAppEntryChunks(nextDir)
const rootFiles = [
  ...(buildManifest?.polyfillFiles ?? []),
  ...(buildManifest?.rootMainFiles ?? []),
  ...(appEntryChunks.get("[project]/app/layout") ?? []),
  ...(appEntryChunks.get("[project]/app/page") ?? []),
]
const rootFirstLoadBytes = totalUniqueBytes(rootFiles)

if (rootFirstLoadBytes > budget.maxRootFirstLoadJsBytes) {
  fail(
    `Root first-load JS is ${rootFirstLoadBytes} bytes, budget is ${budget.maxRootFirstLoadJsBytes}.`
  )
}

if (appEntryChunks.size === 0) {
  fail("Bundle check found no application route entries to evaluate.")
}

for (const [entry, files] of appEntryChunks) {
  const total = totalUniqueBytes(files)
  if (total > budget.maxRouteFirstLoadJsBytes) {
    fail(
      `${entry} first-load JS is ${total} bytes, budget is ${budget.maxRouteFirstLoadJsBytes}.`
    )
  }
}

for (const file of listFiles(join(nextDir, "static/chunks"))) {
  if (!file.endsWith(".js")) continue
  const bytes = statSync(file).size
  if (bytes > budget.maxSingleChunkBytes) {
    fail(
      `${relative(root, file)} is ${bytes} bytes, budget is ${budget.maxSingleChunkBytes}.`
    )
  }
}

console.log(
  `Bundle budget passed: root first-load JS ${rootFirstLoadBytes} bytes, ${appEntryChunks.size} app entries checked.`
)

function readJsonIfExists(file) {
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, "utf8"))
}

function readAppEntryChunks(dir) {
  const entries = new Map()
  const manifestFiles = listFiles(join(dir, "server/app")).filter((file) =>
    file.endsWith("_client-reference-manifest.js")
  )

  for (const file of manifestFiles) {
    const source = readFileSync(file, "utf8")
    const rawEntries = readJsonObjectAfter(source, '"entryJSFiles"')
    if (!rawEntries) continue

    for (const [entry, chunks] of Object.entries(rawEntries)) {
      entries.set(entry, chunks)
    }
  }

  return entries
}

function readJsonObjectAfter(source, marker) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) return null

  const objectStart = source.indexOf("{", markerIndex)
  if (objectStart === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = inString
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === "{") depth += 1
    if (char === "}") depth -= 1

    if (depth === 0) {
      return JSON.parse(source.slice(objectStart, index + 1))
    }
  }

  return null
}

function totalUniqueBytes(files) {
  const seen = new Set()
  let total = 0
  for (const file of files) {
    const normalized = file.replace(/^\/_next\//, "")
    if (seen.has(normalized)) continue
    seen.add(normalized)
    const absolute = join(nextDir, normalized)
    if (existsSync(absolute)) total += statSync(absolute).size
  }
  return total
}

function listFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(absolute) : [absolute]
  })
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
