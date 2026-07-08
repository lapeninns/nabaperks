#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const playwrightArgs = process.argv.slice(2).filter((arg) => arg !== "--")
const projectDir = process.cwd()
const env = {
  ...readEnvFile(join(projectDir, ".env")),
  ...readEnvFile(join(projectDir, ".env.local")),
  ...process.env,
}

const result = spawnSync("playwright", ["test", ...playwrightArgs], {
  env,
  stdio: "inherit",
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const parsed = {}

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")

    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }

  return parsed
}
