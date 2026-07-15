import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const configPath = "config/feature-flags.json"
const config = JSON.parse(readFileSync(configPath, "utf8"))
const today = new Date().toISOString().slice(0, 10)
const errors = []
const keys = new Set()

if (!Array.isArray(config.flags) || config.flags.length === 0) {
  errors.push("At least one feature flag must be defined.")
}

for (const flag of config.flags ?? []) {
  if (!/^[a-z][a-z0-9_]*$/.test(flag.key ?? "")) {
    errors.push(`Invalid flag key: ${String(flag.key)}`)
  }
  if (keys.has(flag.key)) errors.push(`Duplicate flag key: ${flag.key}`)
  keys.add(flag.key)
  if (!flag.owner) errors.push(`${flag.key}: owner is required`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(flag.expiresOn ?? "")) {
    errors.push(`${flag.key}: expiresOn must use YYYY-MM-DD`)
  } else if (flag.expiresOn < today) {
    errors.push(`${flag.key}: expired on ${flag.expiresOn}`)
  }
  if (typeof flag.defaultEnabled !== "boolean") {
    errors.push(`${flag.key}: defaultEnabled must be boolean`)
  }
  if (!/^NABAPERKS_FEATURE_[A-Z0-9_]+$/.test(flag.environmentVariable ?? "")) {
    errors.push(`${flag.key}: environmentVariable must use NABAPERKS_FEATURE_*`)
  }
}

const tracked = spawnSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "*.ts",
    "*.tsx",
    "*.mjs",
    ".env.example",
  ],
  { encoding: "utf8" }
)
if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr)
  process.exit(tracked.status ?? 1)
}

const sourcePaths = tracked.stdout
  .split("\0")
  .filter(Boolean)
  .filter((path) => !path.startsWith("tests/"))
  .filter((path) => path !== "scripts/check-feature-flags.mjs")

for (const flag of config.flags ?? []) {
  const usage = sourcePaths.filter(
    (path) =>
      existsSync(path) &&
      (readFileSync(path, "utf8").includes(flag.key) ||
        readFileSync(path, "utf8").includes(flag.environmentVariable))
  )
  if (usage.length === 0) errors.push(`${flag.key}: no runtime usage found`)
}

if (errors.length > 0) {
  console.error("Feature flag lifecycle validation failed:")
  console.error(errors.map((error) => `- ${error}`).join("\n"))
  process.exit(1)
}

console.log(
  `Feature flag lifecycle is current for ${config.flags.length} flag(s).`
)
