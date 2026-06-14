import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { CustomerFlowDemoError } from "./customer-flow-demo-error.ts"

export type CustomerFlowDemoEnv = Readonly<Record<string, string | undefined>>

const projectDir = process.cwd()

export function readCustomerFlowDemoEnv(): CustomerFlowDemoEnv {
  return {
    ...readEnvFile(join(projectDir, ".env")),
    ...readEnvFile(join(projectDir, ".env.local")),
    ...process.env,
  }
}

export function resolveCustomerFlowDbUrl(env: CustomerFlowDemoEnv): string {
  const explicitUrl = env.SUPABASE_DB_URL?.trim()
  if (explicitUrl) return explicitUrl

  const password = env.SUPABASE_DB_PASSWORD?.trim()
  const poolerPath = join(projectDir, "supabase/.temp/pooler-url")
  if (!password || !existsSync(poolerPath)) return ""

  const url = new URL(readFileSync(poolerPath, "utf8").trim())
  url.password = password
  return url.toString()
}

export function shouldRequireCustomerFlowSsl(dbUrl: string): boolean {
  const url = new URL(dbUrl)
  return url.hostname.endsWith("supabase.com")
}

export function requiredCustomerFlowEnv(
  env: CustomerFlowDemoEnv,
  name: string
): string {
  const value = env[name]?.trim()
  if (!value) throw new CustomerFlowDemoError(`${name} is required.`)

  return value
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}

  const parsed: Record<string, string> = {}

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1).trim()
    parsed[key] = unquote(value)
  }

  return parsed
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}
