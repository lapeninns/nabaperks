import { runBoundedCommand } from "./run-bounded-command.mjs"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"
import { browserArguments } from "./browser-workload.mjs"
import { inventoryFromPlaywright, compareInventory } from "./browser-parity.mjs"

// Group existing shards; never change their denominator, selection or worker
// count. Each invocation owns a fresh Playwright server and wrapper cleanup.
export function browserPackRequests({ project, shards }) {
  if (project !== "chromium")
    throw new Error(
      "Only the Chromium packing pilot is qualified for invocation"
    )
  if (
    !Array.isArray(shards) ||
    shards.length < 1 ||
    shards.length > 4 ||
    new Set(shards).size !== shards.length
  )
    throw new Error("A pilot group requires one to four unique existing shards")
  return shards.map((shard) => ({
    shard,
    args: browserArguments({
      plane: "hosted",
      suite: "test:e2e",
      project,
      shard,
    }),
  }))
}

export async function runBrowserPack(
  { project, shards, output, listOnly = false },
  { run = runBoundedCommand, env = process.env } = {}
) {
  const requests = browserPackRequests({ project, shards })
  const directory = resolve(output)
  if (existsSync(directory))
    throw new Error("Pilot evidence directory must be new")
  if (existsSync(".env") || existsSync(".env.local"))
    throw new Error(
      "Pilot requires a fixture-only checkout without local environment files"
    )
  if (
    env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1" ||
    env.PLAYWRIGHT_NEXT_DIST_DIR
  )
    throw new Error(
      "Pilot cannot reuse a server or caller-owned build directory"
    )
  mkdirSync(directory, { recursive: true })
  const results = []
  for (const request of requests) {
    const id = request.shard.replace("/", "-of-")
    const reportPath = join(directory, `${id}.json`)
    const startedAt = Date.now()
    const result = await run(
      "pnpm",
      [
        "exec",
        "node",
        "scripts/run-playwright.mjs",
        ...request.args.slice(1),
        "--reporter=json",
        `--output=${join(directory, `results-${id}`)}`,
        ...(listOnly ? ["--list"] : []),
      ],
      {
        env: {
          ...env,
          CI: "1",
          PLAYWRIGHT_WORKERS: "1",
          PLAYWRIGHT_REGULAR_CHROMIUM: "1",
          PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
        },
        stdio: "inherit",
        timeout: 20 * 60_000,
      }
    )
    const entry = {
      shard: request.shard,
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      exitCode: result.status,
      signal: result.signal ?? null,
      cleanupVerified: result.cleanupVerified === true,
      unexpectedSurvivors: result.unexpectedSurvivors ?? null,
      report: reportPath,
    }
    results.push(entry)
    writeFileSync(
      join(directory, "execution.json"),
      JSON.stringify({ listOnly, project, results }, null, 2) + "\n"
    )
    if (
      result.error ||
      result.signal ||
      result.status !== 0 ||
      result.cleanupVerified !== true ||
      result.unexpectedSurvivors
    )
      throw new Error(
        `Browser pilot failed in shard ${request.shard}; evidence retained`
      )
    // A successful process without report/test records is not a passing pilot.
    entry.tests = inventoryFromPlaywright(
      JSON.parse(readFileSync(reportPath, "utf8"))
    )
    if (
      !listOnly &&
      entry.tests.some(
        (test) =>
          !["passed", "skipped"].includes(test.status) ||
          test.retries ||
          test.flaky
      )
    )
      throw new Error("Pilot has incomplete, failed or flaky runtime evidence")
  }
  const evidence = {
    schema: "nabaperks.browser-pack-pilot.v1",
    listOnly,
    project,
    results,
  }
  writeFileSync(
    join(directory, "execution.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  )
  return evidence
}

export function comparePackInventory(before, after) {
  if (
    before.project !== after.project ||
    JSON.stringify(before.results.map((entry) => entry.shard).sort()) !==
      JSON.stringify(after.results.map((entry) => entry.shard).sort())
  )
    throw new Error("Pilot project or shard partition differs")
  return compareInventory(
    before.results.flatMap((entry) => entry.tests),
    after.results.flatMap((entry) => entry.tests)
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [project, shardList, output, mode, ...extra] = process.argv.slice(2)
    if (!output || extra.length || (mode && mode !== "--list"))
      throw new Error(
        "Usage: browser-pack.mjs chromium 1/32,2/32 <new-evidence-directory> [--list]"
      )
    await runBrowserPack({
      project,
      shards: shardList.split(","),
      output,
      listOnly: mode === "--list",
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
