#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path"

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
  ...(appEntryChunks.get("/") ?? []),
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
  if (entry.startsWith("/"))
    console.log(`${entry} first-load JS ${total} bytes`)
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
  const manifestFiles = listFiles(join(dir, "server/app"))
    .filter((file) => file.endsWith("_client-reference-manifest.js"))
    .sort()
  const sources = manifestFiles.map((file) => [
    file,
    readFileSync(file, "utf8"),
  ])
  const hasCurrentManifest = sources.some(([, source]) =>
    source.includes("__RSC_MANIFEST[")
  )

  if (hasCurrentManifest) return readCurrentAppEntryChunks(dir, sources)

  for (const [, source] of sources) {
    const rawEntries = readJsonObjectAfter(source, '"entryJSFiles"')
    if (!rawEntries) continue

    for (const [entry, chunks] of Object.entries(rawEntries)) {
      entries.set(entry, chunks)
    }
  }

  return entries
}

function readCurrentAppEntryChunks(dir, sources) {
  const buildIdPath = join(dir, "BUILD_ID")
  if (
    !existsSync(buildIdPath) ||
    readFileSync(buildIdPath, "utf8").trim() === ""
  ) {
    fail("Current Next build has a missing or blank BUILD_ID.")
  }

  const routeMap = readRequiredJson(join(dir, "app-path-routes-manifest.json"))
  const chunksByRouteKey = new Map()
  for (const [file, source] of sources) {
    const routeMatch = source.match(/__RSC_MANIFEST\[("(?:\\.|[^"\\])*")\]=/)
    if (!routeMatch)
      fail(`Malformed RSC client-reference manifest: ${relative(root, file)}.`)
    const routeKey = JSON.parse(routeMatch[1])
    const manifest = readJsonObjectAfter(source, routeMatch[0])
    if (!manifest || !isRecord(manifest.clientModules)) {
      fail(`Malformed clientModules graph for ${routeKey}.`)
    }
    if (chunksByRouteKey.has(routeKey))
      fail(`Duplicate client manifest for ${routeKey}.`)

    const chunks = []
    for (const clientModule of Object.values(manifest.clientModules)) {
      if (!isRecord(clientModule) || !Array.isArray(clientModule.chunks)) {
        fail(`Malformed client module for ${routeKey}.`)
      }
      if (clientModule.chunks.length % 2 !== 0) {
        fail(`Odd client chunk tuple for ${routeKey}.`)
      }
      for (let index = 0; index < clientModule.chunks.length; index += 2) {
        const chunkId = clientModule.chunks[index]
        const chunkPath = clientModule.chunks[index + 1]
        if (typeof chunkId !== "string" || !/^\d+$/.test(chunkId)) {
          fail(`Non-numeric client chunk id for ${routeKey}.`)
        }
        if (typeof chunkPath !== "string")
          fail(`Invalid client chunk path for ${routeKey}.`)
        chunks.push(normalizeChunkPath(chunkPath))
      }
    }
    chunksByRouteKey.set(routeKey, [...new Set(chunks)].sort())
  }

  const auditedRoutes = new Set([
    "/",
    "/pricing",
    "/loyalty-for-pubs",
    "/signup",
  ])
  const entries = new Map()
  for (const [routeKey, publicPath] of Object.entries(routeMap).sort()) {
    if (!routeKey.endsWith("/page") || !auditedRoutes.has(publicPath)) continue
    const chunks = chunksByRouteKey.get(routeKey)
    if (!chunks) fail(`Missing client-reference manifest for ${routeKey}.`)
    if (entries.has(publicPath)) fail(`Duplicate audited route ${publicPath}.`)
    entries.set(publicPath, chunks)
  }
  if (entries.size !== auditedRoutes.size)
    fail("Current Next build is missing an audited page route.")
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
    const normalized = normalizeChunkPath(file.replace(/^\/_next\//, ""))
    if (seen.has(normalized)) continue
    seen.add(normalized)
    const absolute = join(nextDir, normalized)
    total += statSync(absolute).size
  }
  return total
}

function normalizeChunkPath(file) {
  let decoded
  try {
    decoded = decodeURIComponent(file)
  } catch {
    fail(`Invalid URI-encoded chunk path ${file}.`)
  }
  if (
    isAbsolute(decoded) ||
    !decoded.startsWith("static/chunks/") ||
    !decoded.endsWith(".js") ||
    decoded.includes("\0") ||
    decoded.split("/").includes("..")
  ) {
    fail(`Unsafe chunk path ${file}.`)
  }
  const absolute = normalize(resolve(nextDir, decoded))
  const fromNext = relative(nextDir, absolute)
  if (!fromNext || fromNext.startsWith(`..${sep}`) || !existsSync(absolute)) {
    fail(`Missing or escaped chunk ${file}.`)
  }
  const metadata = lstatSync(absolute)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    fail(`Chunk is not a regular file ${file}.`)
  }
  return decoded
}

function readRequiredJson(file) {
  if (!existsSync(file))
    fail(`Missing required manifest ${relative(root, file)}.`)
  try {
    const value = JSON.parse(readFileSync(file, "utf8"))
    if (!isRecord(value))
      fail(`Invalid manifest object ${relative(root, file)}.`)
    return value
  } catch (error) {
    fail(
      `Invalid JSON in ${relative(root, file)}: ${error instanceof Error ? error.message : "unknown error"}.`
    )
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
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
