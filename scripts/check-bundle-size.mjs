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

/**
 * Chunk paths that no file on disk answers to. A missing file used to be
 * skipped in silence, which under-counted 28 of the 118 route payloads: a
 * dynamic segment is PERCENT-ENCODED inside the route manifest
 * (`static/chunks/app/card/%5BmembershipId%5D/page-*.js`) while the file on
 * disk is `[membershipId]`, so every dynamic route's own page chunk — 93,882
 * bytes in total — was excluded from the budget it is supposed to be measured
 * against. Decoding is tried first; anything still unresolved is recorded and
 * fails the run below rather than quietly shrinking a payload.
 */
const unresolvedChunks = new Set()

const budget = JSON.parse(readFileSync(budgetPath, "utf8"))
const buildManifest = readJsonIfExists(join(nextDir, "build-manifest.json"))
const { entries: appEntryChunks, manifestCount } = readAppEntryChunks(nextDir)
assertRoutesParsed(appEntryChunks, manifestCount)
const rootFiles = [
  ...(buildManifest?.polyfillFiles ?? []),
  ...(buildManifest?.rootMainFiles ?? []),
  // Deliberately NOT the "/" route's client chunks. Before the parser fix this
  // lookup silently returned nothing, so "root first-load JS" has always meant
  // polyfills + rootMainFiles, and that is the number the QA certification
  // matrix records. Folding the route payload in here would redefine a tracked
  // metric from 540,731 to 900,075 bytes against a 950,000 budget — a
  // near-breach caused by a measurement change rather than by any code change.
  // The "/" route is covered by the per-route budget below, which now works.
]
const rootFirstLoadBytes = totalUniqueBytes(rootFiles)

if (rootFirstLoadBytes > budget.maxRootFirstLoadJsBytes) {
  fail(
    `Root first-load JS is ${rootFirstLoadBytes} bytes, budget is ${budget.maxRootFirstLoadJsBytes}.`
  )
}

let largestEntry = { route: "(none)", bytes: 0 }

for (const [entry, files] of appEntryChunks) {
  const total = totalUniqueBytes(files)
  if (total > largestEntry.bytes) largestEntry = { route: entry, bytes: total }
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

/**
 * A reference the budget could not weigh is a hole in the budget, not a
 * detail: see resolveChunkFile above for the 28 dynamic-route page chunks this
 * caught. Fail rather than report a payload that is missing a part of itself.
 */
if (unresolvedChunks.size > 0) {
  fail(
    `${unresolvedChunks.size} chunk reference(s) in the build manifests match no file on disk, ` +
      "so the payloads above are under-counted:\n  " +
      [...unresolvedChunks].sort().slice(0, 10).join("\n  ")
  )
}

console.log(
  `Bundle budget passed: root first-load JS ${rootFirstLoadBytes} bytes, ${appEntryChunks.size} app entries checked, ` +
    `largest route ${largestEntry.route} at ${largestEntry.bytes} bytes.`
)

function readJsonIfExists(file) {
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, "utf8"))
}

/**
 * Per-route client chunks, read from each route's RSC manifest.
 *
 * This used to look for an `"entryJSFiles"` object. Next no longer emits one —
 * the manifests carry `"entryCSSFiles"` and nothing equivalent for JS — so the
 * lookup returned null for every manifest, the map came back empty, and the
 * per-route budget below iterated over nothing. The check reported
 * "0 app entries checked" and exited 0 for every build. The route budget has
 * therefore never been enforced on this Next version.
 *
 * The data is still there, one level down: every `clientModules` entry carries
 * a `chunks` array of real `static/chunks/*.js` paths. Unioning those per route
 * reproduces the route's client payload. 150 routes now parse, the largest
 * being /app/launch at ~532KB against a 900KB budget.
 *
 * If a future Next release moves this again, `assertRoutesParsed` below fails
 * loudly instead of letting the budget go quiet a second time.
 */
function readAppEntryChunks(dir) {
  const entries = new Map()
  const manifestFiles = listFiles(join(dir, "server/app")).filter((file) =>
    file.endsWith("_client-reference-manifest.js")
  )

  for (const file of manifestFiles) {
    const source = readFileSync(file, "utf8")
    const chunks = new Set()

    for (const match of source.matchAll(/"chunks":\[([^\]]*)\]/g)) {
      for (const chunk of match[1].matchAll(/"(static\/chunks\/[^"]+\.js)"/g)) {
        chunks.add(chunk[1])
      }
    }

    if (chunks.size === 0) continue

    const route =
      file
        .replace(join(dir, "server/app"), "")
        .replace("/page_client-reference-manifest.js", "") || "/"
    entries.set(route, [...chunks])
  }

  return { entries, manifestCount: manifestFiles.length }
}

/**
 * A budget that silently measures nothing is worse than no budget, because it
 * reports PASS. If manifests exist but none parsed, the format moved.
 */
function assertRoutesParsed(entries, manifestCount) {
  if (manifestCount > 0 && entries.size === 0) {
    fail(
      `Found ${manifestCount} route manifests but parsed 0 client chunk lists. ` +
        "The Next manifest format has changed and the per-route bundle budget " +
        "is no longer being enforced. Fix readAppEntryChunks in this script."
    )
  }
}

function resolveChunkFile(reference) {
  const normalized = reference.replace(/^\/_next\//, "")
  const candidates = [normalized]
  try {
    const decoded = decodeURIComponent(normalized)
    if (decoded !== normalized) candidates.push(decoded)
  } catch {
    // A malformed escape sequence is itself an unresolvable reference.
  }
  for (const candidate of candidates) {
    const absolute = join(nextDir, candidate)
    if (existsSync(absolute)) return { key: candidate, absolute }
  }
  return null
}

function totalUniqueBytes(files) {
  const seen = new Set()
  let total = 0
  for (const file of files) {
    const resolved = resolveChunkFile(file)
    if (!resolved) {
      unresolvedChunks.add(file)
      continue
    }
    if (seen.has(resolved.key)) continue
    seen.add(resolved.key)
    total += statSync(resolved.absolute).size
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
