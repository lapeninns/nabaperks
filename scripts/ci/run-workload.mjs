import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export const workloads = JSON.parse(
  readFileSync(
    new URL("../../config/ci-workloads.json", import.meta.url),
    "utf8"
  )
)

export function runWorkload(
  name,
  { spawn = spawnSync, report = console.log } = {}
) {
  const commands =
    Object.hasOwn(workloads.commands, name) && workloads.commands[name]
  if (!Array.isArray(commands) || commands.length === 0)
    throw new Error(`Unknown or empty CI workload: ${name}`)
  for (const [command, ...args] of commands) {
    const started = Date.now()
    const result = spawn(command, args, { stdio: "inherit" })
    report(
      JSON.stringify({
        workload: name,
        command: [command, ...args],
        durationMs: Date.now() - started,
        status: result.status,
        signal: result.signal ?? null,
      })
    )
    if (result.error) throw result.error
    if (result.status !== 0 || result.signal) return result.status || 1
  }
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: node scripts/ci/run-workload.mjs <workload>")
    process.exitCode = runWorkload(process.argv[2])
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
