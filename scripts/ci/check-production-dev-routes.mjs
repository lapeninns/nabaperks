import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { pathToFileURL } from "node:url"

// Every page and route handler under app/dev is a development harness. The
// dev layout calls notFound() in production and each route handler returns 404
// itself (layouts do not wrap route handlers). Source-level contracts check
// that shape; this probe checks the behaviour of a real production build.
export function devRoutePaths(root = "app/dev") {
  const paths = []
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) visit(path)
      else if (/^(page\.tsx|route\.ts)$/.test(name))
        paths.push(routeForFile(relative("app", directory)))
    }
  }
  visit(root)
  return [...new Set(paths)]
}

export function routeForFile(directory) {
  const segments = directory
    .split(sep)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) =>
      /^\[.*\]$/.test(segment) ? "probe" : encodeURIComponent(segment)
    )
  return `/${segments.join("/")}`
}

export async function checkDevRoutes(
  origin,
  paths = devRoutePaths(),
  fetcher = fetch
) {
  if (paths.length === 0) throw new Error("No /dev routes were discovered")
  const failures = []
  for (const path of paths) {
    const response = await fetcher(new URL(path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status !== 404) failures.push(`${path} -> ${response.status}`)
  }
  if (failures.length)
    throw new Error(
      `Development routes are reachable in the production build:\n${failures.join("\n")}`
    )
  return paths.length
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [origin] = process.argv.slice(2)
    if (!origin)
      throw new Error("Usage: check-production-dev-routes.mjs <origin>")
    const count = await checkDevRoutes(origin)
    console.log(`All ${count} /dev routes return 404 in the production build.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
