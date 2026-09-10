import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
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
 * The exit code a shard's outcome deserves. **Pure.**
 *
 * A shard the kernel killed and a shard whose assertions failed are different
 * facts about a run, and `result.signal ? 1 : status` collapsed them into the
 * one code Playwright already uses for a red suite. That is how the memory
 * cgroup killing `next-server` mid-shard reached the lane record as an
 * ordinary test failure, with the surviving tests' ECONNREFUSED as its
 * evidence. A signalled shard therefore reports 128 + the signal number, the
 * convention a shell uses for the same fact, so no reader has to infer which
 * of the two happened.
 */
export function browserExitCode({ status = null, signal = null } = {}) {
  if (!signal) return status ?? 1
  const numbers = {
    SIGKILL: 9,
    SIGTERM: 15,
    SIGABRT: 6,
    SIGSEGV: 11,
    SIGINT: 2,
  }
  return 128 + (numbers[signal] ?? 0)
}

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
