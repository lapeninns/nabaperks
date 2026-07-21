import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { parseEnvText } from "../env-file.mjs"

export function loadProjectEnv(projectDir) {
  const env = {
    ...readEnvFile(join(projectDir, ".env")),
    ...readEnvFile(join(projectDir, ".env.local")),
    ...process.env,
  }

  return {
    ...env,
    SUPABASE_DB_URL: resolveSupabaseDbUrl(projectDir, env),
  }
}

export function createReport() {
  const results = []

  return {
    results,
    pass(gate, message) {
      results.push({ status: "PASS", gate, message })
    },
    fail(gate, message) {
      results.push({ status: "FAIL", gate, message })
    },
    blocked(gate, message) {
      results.push({ status: "BLOCKED", gate, message })
    },
  }
}

export function printReport(results) {
  for (const result of results) {
    console.log(`${result.status.padEnd(7)} ${result.gate} - ${result.message}`)
  }
}

export async function getJson(url, headers) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    let body = {}
    try {
      body = await response.json()
    } catch {
      body = {}
    }
    return { ok: response.ok, status: response.status, body }
  } catch (error) {
    return { ok: false, status: errorName(error), body: {} }
  } finally {
    clearTimeout(timeout)
  }
}

export function value(env, name) {
  return env[name]?.trim() || ""
}

export function resolveSupabaseDbUrl(projectDir, env) {
  const explicitUrl = value(env, "SUPABASE_DB_URL")

  if (explicitUrl) return explicitUrl

  const password = value(env, "SUPABASE_DB_PASSWORD")
  const poolerUrlPath = join(projectDir, "supabase/.temp/pooler-url")

  if (!password || !existsSync(poolerUrlPath)) return ""

  try {
    const url = new URL(readFileSync(poolerUrlPath, "utf8").trim())
    url.password = password
    return url.toString()
  } catch {
    return ""
  }
}

export function shouldRequireSsl(dbUrl) {
  try {
    const hostname = new URL(dbUrl).hostname.toLowerCase()
    const registrableDomain = hostname.split(".").slice(-2).join(".")

    return (
      registrableDomain === "supabase.com" ||
      registrableDomain === "supabase.co"
    )
  } catch {
    return false
  }
}

export function isLocalUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  } catch {
    return false
  }
}

export function originLabel(rawUrl) {
  try {
    const url = new URL(rawUrl)
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`
  } catch {
    return "configured target"
  }
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  return parseEnvText(readFileSync(path, "utf8"))
}

function errorName(error) {
  return error instanceof Error ? error.name : "network-error"
}
