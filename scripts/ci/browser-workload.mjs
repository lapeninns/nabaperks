import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { workloads } from "./run-workload.mjs"
import { processExitCode } from "./process-exit.mjs"

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
  const excluded = [
    ...new Set([
      ...(plane === "local" ? ["@visual"] : []),
      ...(definition.grepInvert?.split("|") ?? []),
    ]),
  ]
  if (excluded.length) args.push("--grep-invert", excluded.join("|"))
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

export function browserReportName(args) {
  const project = args
    .find((value) => value.startsWith("--project="))
    ?.slice(10)
  const shard = args.find((value) => value.startsWith("--shard="))?.slice(8)
  if (!/^[a-z][a-z-]*$/.test(project ?? "") || !/^\d+\/\d+$/.test(shard ?? ""))
    throw new Error("Browser report requires a validated project and shard")
  return `local-ci-${project}-${shard.replace("/", "-of-")}.json`
}

/**
 * A signal received by Playwright or its wrapper remains distinguishable from
 * an assertion failure. A killed next-server grandchild can still make a live
 * Playwright process exit 1; that case needs kernel/cgroup and server evidence.
 */
export const browserExitCode = processExitCode

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = parseBrowserRequest(process.argv.slice(2))
    const env = { ...process.env }
    if (env.LOCAL_CI_BROWSER_JSON === "1") {
      env.PLAYWRIGHT_JSON_OUTPUT_FILE = resolve(browserReportName(args))
      if (existsSync(env.PLAYWRIGHT_JSON_OUTPUT_FILE))
        throw new Error(
          "Browser report already exists; refusing stale evidence"
        )
      args.push("--reporter=line,json")
    }
    const result = spawnSync(
      "pnpm",
      ["exec", "node", "scripts/run-playwright.mjs", ...args.slice(1)],
      { stdio: "inherit", env }
    )
    if (result.error) throw result.error
    if (result.signal)
      console.error(
        `browser workload terminated by signal ${result.signal}; this is an infrastructure failure, not a test result`
      )
    process.exitCode = browserExitCode(result)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
