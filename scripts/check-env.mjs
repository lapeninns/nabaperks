import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const projectDir = process.cwd()
const nodeEnv = process.env.NODE_ENV || "development"
const envContract = JSON.parse(
  readFileSync(join(projectDir, "config/env-contract.json"), "utf8")
)

const envFiles = [
  `.env.${nodeEnv}.local`,
  nodeEnv === "test" ? "" : ".env.local",
  `.env.${nodeEnv}`,
  ".env",
].filter(Boolean)

function parseEnvFile(path) {
  const parsed = {}
  const content = readFileSync(path, "utf8")

  for (const line of content.split(/\r?\n/)) {
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

const values = {}

for (const file of envFiles.reverse()) {
  const path = join(projectDir, file)

  if (!existsSync(path)) continue

  Object.assign(values, parseEnvFile(path))
}

Object.assign(values, process.env)

const missing = []
const invalid = []

for (const entry of envContract) {
  const value = values[entry.name]?.trim()

  if (!value) {
    if (entry.optional) continue
    missing.push(entry.name)
    continue
  }

  if (entry.visibility === "public" && !entry.name.startsWith("NEXT_PUBLIC_")) {
    invalid.push(`${entry.name} must be prefixed with NEXT_PUBLIC_`)
  }

  if (entry.visibility === "server" && entry.name.startsWith("NEXT_PUBLIC_")) {
    invalid.push(`${entry.name} must not be prefixed with NEXT_PUBLIC_`)
  }

  if (entry.kind === "url") {
    try {
      const url = new URL(value)

      if (!["http:", "https:"].includes(url.protocol)) {
        invalid.push(`${entry.name} must use http or https`)
      }
    } catch {
      invalid.push(`${entry.name} must be a valid URL`)
    }
  }
}

if (
  values.TWILIO_VERIFY_SERVICE_SID?.trim() &&
  !values.TWILIO_AUTH_TOKEN?.trim() &&
  !(values.TWILIO_API_KEY_SID?.trim() && values.TWILIO_API_KEY_SECRET?.trim())
) {
  missing.push("TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET")
}

if (missing.length || invalid.length) {
  console.error("Nabaperks environment configuration is incomplete.")

  if (missing.length) {
    console.error(`Missing: ${missing.join(", ")}`)
  }

  if (invalid.length) {
    console.error(`Invalid: ${invalid.join(", ")}`)
  }

  console.error("Copy .env.example to .env.local and fill the required values.")
  process.exit(1)
}

console.log("Nabaperks environment configuration is valid.")
