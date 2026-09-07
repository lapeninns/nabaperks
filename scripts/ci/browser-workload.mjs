import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { workloads } from "./run-workload.mjs"

export function browserArguments({ plane, suite, project, shard }) {
  if (!["hosted", "local"].includes(plane))
    throw new Error("Unknown execution plane")
  const definition =
    Object.hasOwn(workloads.browsers, suite) && workloads.browsers[suite]
  if (!definition || !definition.projects.includes(project))
    throw new Error("Unknown browser suite or project")
  const denominator = definition[`${plane}Shards`]
  const match = /^(\d+)\/(\d+)$/.exec(shard ?? "")
  if (
    !denominator ||
    !match ||
    Number(match[2]) !== denominator ||
    Number(match[1]) < 1 ||
    Number(match[1]) > denominator
  )
    throw new Error("Invalid or unqualified browser shard")
  const args = ["test", `--project=${project}`]
  if (definition.grep) args.push("--grep", definition.grep)
  if (definition.grepInvert || plane === "local")
    args.push("--grep-invert", "@visual")
  if (plane === "local") args.push("--ignore-snapshots")
  args.push(`--shard=${shard}`)
  return args
}

export function parseBrowserRequest(args) {
  const [plane, suite, ...flags] = args
  const project = flags.find((flag) => flag.startsWith("--project="))?.slice(10)
  const shard = flags.find((flag) => flag.startsWith("--shard="))?.slice(8)
  const request = { plane, suite, project, shard }
  const generated = browserArguments(request)
  // Explicit guards stay visible to the existing profile snapshot validator.
  const expected = generated
    .slice(1)
    .filter((flag, i, all) => flag !== "--grep" && all[i - 1] !== "--grep")
  if (JSON.stringify(flags) !== JSON.stringify(expected))
    throw new Error("Browser flags differ from the reviewed workload")
  return generated
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = parseBrowserRequest(process.argv.slice(2))
    const result = spawnSync(
      "pnpm",
      ["exec", "node", "scripts/run-playwright.mjs", ...args.slice(1)],
      { stdio: "inherit" }
    )
    if (result.error) throw result.error
    process.exitCode = result.signal ? 1 : (result.status ?? 1)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
