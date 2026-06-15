import { spawnSync } from "node:child_process"

/**
 * Tracked + untracked-but-not-ignored files, mirroring the source-of-truth the
 * no-legacy-naming test uses. Optionally filter to a set of path prefixes.
 */
export function trackedFiles(prefixes = []) {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" }
  )

  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`)
  }

  const files = result.stdout.split("\n").filter((line) => line.length > 0)

  if (prefixes.length === 0) return files

  return files.filter((file) =>
    prefixes.some((prefix) => file.startsWith(prefix))
  )
}

export function parseMaxArg(argv, fallback) {
  const arg = argv.find((value) => value.startsWith("--max="))
  if (!arg) return fallback
  const parsed = Number.parseInt(arg.slice("--max=".length), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
