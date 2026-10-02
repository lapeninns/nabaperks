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

const budget = readJson(budgetPath)
for (const name of [
  "maxRootFirstLoadJsBytes",
  "maxRouteFirstLoadJsBytes",
  "maxSingleChunkBytes",
]) {
  if (!Number.isSafeInteger(budget[name]) || budget[name] < 0)
    fail(`Invalid bundle budget ${name}.`)
}
const buildManifest = readJson(join(nextDir, "build-manifest.json"))
if (
  !Array.isArray(buildManifest.rootMainFiles) ||
  !buildManifest.rootMainFiles.length ||
  !Array.isArray(buildManifest.polyfillFiles)
) {
  fail(
    "Unsupported build-manifest.json: expected nonempty rootMainFiles and polyfillFiles arrays."
  )
}
// Next emits polyfillFiles with nomodule: supported Chrome/Edge 111+, Firefox
// 111+ and Safari 16.4+ do not request them. Validate and report that alternative
// separately; the single-chunk guard below still covers every emitted file.
const fallbackBytes = totalUniqueBytes(buildManifest.polyfillFiles)
const sharedFiles = buildManifest.rootMainFiles
console.log(
  `Validated nomodule fallback ${fallbackBytes} bytes (separate browser path).`
)
const appEntryChunks = readAppEntryChunks(nextDir)
const homeEntries = [...appEntryChunks].filter(
  ([entry]) => entry.replace(/\/\([^/]+\)/g, "") === "/page"
)
if (homeEntries.length !== 1)
  fail(`Expected one homepage entry; found ${homeEntries.length}.`)
const rootFiles = [...sharedFiles, ...homeEntries[0][1]]
const rootFirstLoadBytes = totalUniqueBytes(rootFiles)

if (rootFirstLoadBytes > budget.maxRootFirstLoadJsBytes) {
  fail(
    `Root first-load JS is ${rootFirstLoadBytes} bytes, budget is ${budget.maxRootFirstLoadJsBytes}.`
  )
}

const measurements = [...appEntryChunks].map(([entry, files]) => [
  entry,
  totalUniqueBytes([...sharedFiles, ...files]),
])
const oversized = []
for (const [entry, total] of measurements) {
  if (total > budget.maxRouteFirstLoadJsBytes) {
    oversized.push(
      `${entry} first-load JS is ${total} bytes, budget is ${budget.maxRouteFirstLoadJsBytes}.`
    )
  }
}
console.log(
  `Bundle discovery: ${appEntryChunks.size} app entries checked; largest route ${Math.max(...measurements.map(([, total]) => total))} bytes.`
)
console.log(
  `Legacy-additive union (outside supported-browser profile): largest route ${Math.max(...measurements.map(([, total]) => total + fallbackBytes))} bytes; ${measurements.filter(([, total]) => total + fallbackBytes > budget.maxRouteFirstLoadJsBytes).length} routes exceed ${budget.maxRouteFirstLoadJsBytes} bytes.`
)
if (oversized.length) fail(oversized.join("\n"))

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

function readJson(file) {
  try {
    const result = JSON.parse(readFileSync(file, "utf8"))
    if (!isObject(result))
      fail(`Expected JSON object in ${relative(root, file)}.`)
    return result
  } catch (error) {
    fail(`Cannot read ${relative(root, file)}: ${error.message}`)
  }
}

function readAppEntryChunks(dir) {
  const entries = new Map()
  const initial = readJson(join(dir, "app-entry-manifest.json"))
  if (
    initial.version !== 3 ||
    initial.buildId !== readFileSync(join(dir, "BUILD_ID"), "utf8").trim() ||
    !isObject(initial.entries)
  )
    fail("Unsupported or stale app-entry-manifest.json.")
  if (initial.version >= 2 && !isObject(initial.initialModules))
    fail("Missing initial component module graph in app-entry-manifest.json.")
  if (
    initial.version === 3 &&
    (!isObject(initial.ssrReferences) ||
      !Object.values(initial.ssrReferences).some(
        (references) => Array.isArray(references) && references.length
      ))
  )
    fail("Missing SSR client reference graph.")
  const paths = readJson(join(dir, "server/app-paths-manifest.json"))
  const pages = Object.entries(paths).filter(([route]) =>
    route.endsWith("/page")
  )
  if (!pages.length)
    fail("No App Router page routes found in app-paths-manifest.json.")
  for (const [route, bundle] of pages) {
    if (
      typeof bundle !== "string" ||
      !/^app\/.+\.js$/.test(bundle) ||
      bundle.split("/").includes("..")
    ) {
      fail(`Unsupported page bundle path for ${route}.`)
    }
    const file = join(
      dir,
      "server",
      bundle.replace(/\.js$/, "_client-reference-manifest.js")
    )
    let manifest
    try {
      // Read only the JSON assignment emitted by the pinned webpack plugin.
      // Never execute build output as JavaScript to inspect its references.
      const source = readFileSync(file, "utf8")
      const match = source.match(
        /^globalThis\.__RSC_MANIFEST=\(globalThis\.__RSC_MANIFEST\|\|\{\}\);globalThis\.__RSC_MANIFEST\[("(?:\\.|[^"\\])*")\]=([\s\S]*);\s*$/
      )
      if (!match || JSON.parse(match[1]) !== route)
        fail(
          `Unsupported client-reference manifest or route binding: ${relative(root, file)}.`
        )
      manifest = JSON.parse(match[2])
    } catch (error) {
      fail(
        `Cannot read client-reference manifest ${relative(root, file)}: ${error.message}`
      )
    }
    if (!isObject(manifest) || !isObject(manifest.clientModules))
      fail(`Unsupported clientModules in ${relative(root, file)}.`)
    const files = []
    for (const reference of Object.values(manifest.clientModules)) {
      if (
        !isObject(reference) ||
        !Array.isArray(reference.chunks) ||
        reference.chunks.length % 2 !== 0
      ) {
        fail(`Unsupported client-reference chunks in ${relative(root, file)}.`)
      }
      for (let index = 0; index < reference.chunks.length; index += 2) {
        const id = reference.chunks[index]
        if (typeof id !== "string" && typeof id !== "number")
          fail(`Invalid chunk ID in ${relative(root, file)}.`)
        files.push(reference.chunks[index + 1])
      }
    }
    // Validate every reference, including sibling and deferred references.
    totalUniqueBytes(files)
    const entry = bundle.replace(/\.js$/, "")
    const own = initial.entries[entry]
    if (!Array.isArray(own) || !own.length)
      fail(`Missing initial webpack page entry: ${entry}.`)
    const initialFiles = [...own]
    const ssrEntries = [entry]
    const parts = entry.split("/").slice(0, -1)
    for (let depth = 1; depth <= parts.length; depth++) {
      const ancestor = parts.slice(0, depth).join("/")
      for (const boundary of [
        "layout",
        "error",
        "loading",
        "global-error",
        "not-found",
        "forbidden",
        "unauthorized",
      ]) {
        const key = `${ancestor}/${boundary}`
        if (!(key in initial.entries)) continue
        const boundaryFiles = initial.entries[key]
        if (!Array.isArray(boundaryFiles) || !boundaryFiles.length)
          fail(`Unsupported initial webpack boundary: ${key}.`)
        initialFiles.push(...boundaryFiles)
        ssrEntries.push(key)
      }
    }
    if (initial.version === 3) {
      for (const ssrEntry of ssrEntries) {
        const references = initial.ssrReferences[ssrEntry]
        if (
          !Array.isArray(references) ||
          references.some((reference) => typeof reference !== "string")
        )
          fail(`Missing SSR references for ${ssrEntry}.`)
        for (const request of references) {
          const reference = manifest.clientModules[request]
          if (!isObject(reference) || !Array.isArray(reference.chunks))
            fail(`Missing emitted SSR client reference: ${request}.`)
          for (let index = 1; index < reference.chunks.length; index += 2)
            initialFiles.push(reference.chunks[index])
        }
      }
    }
    const immediateLoaders = {
      "/app/scan/page":
        "components/merchant/merchant-reward-scanner-loader.tsx -> ./merchant-reward-scanner",
      "/dev/app-harness/scan/page":
        "components/merchant/merchant-reward-scanner-loader.tsx -> ./merchant-reward-scanner",
      "/scan/page":
        "components/customer/customer-qr-scanner-loader.tsx -> ./customer-qr-scanner",
    }
    const key = immediateLoaders[route]
    if (key)
      initialFiles.push(
        ...readImmediateDynamicFiles(key, initial.initialModules?.[entry])
      )
    entries.set(route, initialFiles)
  }
  return entries
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function readImmediateDynamicFiles(key, initialModules) {
  const loadable = readJson(join(nextDir, "react-loadable-manifest.json"))
  const entry = isObject(loadable) ? loadable[key] : undefined
  if (
    isObject(loadable) &&
    (!(key in loadable) ||
      (isObject(entry) && Array.isArray(entry.files) && !entry.files.length))
  ) {
    // An eager import can eliminate the dynamic boundary. Accept it only when
    // the real scanner's emitted references are all already charged initially.
    const source = key.split(" -> ")[0].replace("-loader.tsx", ".tsx")
    if (
      Array.isArray(initialModules) &&
      initialModules.every((module) => typeof module === "string") &&
      initialModules.includes(source)
    )
      return []
  }
  if (!isObject(entry) || !Array.isArray(entry.files) || !entry.files.length)
    fail(`Missing immediate dynamic loader output: ${key}.`)
  if (
    entry.files.some(
      (file) => typeof file !== "string" || !/^static\/.*\.(js|css)$/.test(file)
    )
  )
    fail(`Unsupported immediate dynamic loader output: ${key}.`)
  const files = entry.files.filter((file) => file.endsWith(".js"))
  if (!files.length) fail(`Missing immediate dynamic JavaScript: ${key}.`)
  return files
}

function totalUniqueBytes(files) {
  const seen = new Set()
  let total = 0
  for (const file of files) {
    if (typeof file !== "string") fail("Unsupported JavaScript chunk path.")
    let normalized
    try {
      normalized = decodeURIComponent(file.replace(/^\/_next\//, ""))
    } catch {
      fail(`Malformed JavaScript chunk path: ${file}.`)
    }
    if (
      !/^static\/chunks\/.+\.js$/.test(normalized) ||
      normalized.includes("\\") ||
      normalized.split("/").some((part) => part === ".." || part === ".")
    ) {
      fail(`Unsupported JavaScript chunk path: ${file}.`)
    }
    if (seen.has(normalized)) continue
    seen.add(normalized)
    const absolute = join(nextDir, normalized)
    if (!existsSync(absolute) || !statSync(absolute).isFile())
      fail(`Missing JavaScript chunk: ${normalized}.`)
    total += statSync(absolute).size
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
