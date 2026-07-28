import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { parseEnvText, serializeEnvValue } from "./env-file.mjs"

const projectDir = process.cwd()
const contract = JSON.parse(
  readFileSync(join(projectDir, "config/env-contract.json"), "utf8")
)
const customerOtpBypassModeAnyFourDigits = "any-4-digits"
const twilioVerifyEnvNames = new Set([
  "TWILIO_ACCOUNT_SID",
  "TWILIO_VERIFY_SERVICE_SID",
])
const pseudonymousAnalyticsMode = "pseudonymous"
const pseudonymousAnalyticsRequiredEnvNames = new Set([
  "POSTHOG_PROJECT_KEY",
  "POSTHOG_HOST",
  "ANALYTICS_PSEUDONYM_SECRET",
])

const command = process.argv[2] ?? "status"
const force = process.argv.includes("--force")

if (command === "status") {
  printStatus()
} else if (command === "write-local") {
  writeLocalEnv()
} else if (command === "pull-supabase") {
  pullSupabase()
} else if (command === "set-posthog") {
  setPostHog()
} else if (command === "set-resend") {
  setResend()
} else if (command === "push-vercel") {
  pushVercelEnv()
} else {
  console.error(
    "Usage: pnpm env:keys | pnpm env:write-local [--force] | pnpm env:pull-supabase <project-ref> | pnpm env:set-posthog | pnpm env:set-resend | pnpm env:push-vercel [production|preview|development] [--replace]"
  )
  process.exit(1)
}

function printStatus() {
  console.log("Nabaperks key setup")
  console.log("")
  console.log("Local CLI availability:")
  console.log(
    `- supabase: ${available("supabase") ? "installed" : "use pnpm dlx supabase"}`
  )
  console.log(
    `- stripe: ${available("stripe") ? "installed" : "install with brew install stripe/stripe-cli/stripe"}`
  )
  console.log(
    `- vercel: ${available("vercel") ? "installed" : "use pnpm dlx vercel"}`
  )
  console.log(
    `- resend: ${available("resend") ? "installed" : "use pnpm dlx resend-cli"}`
  )
  console.log(
    `- posthog-cli: ${available("posthog-cli") ? "installed" : "use pnpm dlx @posthog/cli"}`
  )
  console.log("")
  console.log("Provider key sources:")
  console.log("")
  console.log("Supabase:")
  console.log("  pnpm dlx supabase projects list")
  console.log(
    "  pnpm dlx supabase projects api-keys --project-ref <ref> --output json"
  )
  console.log("  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co")
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from api-keys>")
  console.log("  SUPABASE_SERVICE_ROLE_KEY=<service_role key from api-keys>")
  console.log("")
  console.log("Stripe:")
  console.log("  brew install stripe/stripe-cli/stripe")
  console.log("  stripe login")
  console.log("  stripe listen --forward-to localhost:3000/api/stripe/webhook")
  console.log("  STRIPE_WEBHOOK_SECRET=<whsec_... printed by stripe listen>")
  console.log(
    "  STRIPE_GROWTH_PRICE_ID=<price_... from dashboard or stripe prices list>"
  )
  console.log(
    "  STRIPE_GROWTH_ANNUAL_PRICE_ID=<price_... for active GBP 490/year>"
  )
  console.log(
    "  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY come from Stripe API keys."
  )
  console.log("")
  console.log("Google Maps Platform:")
  console.log("  Enable Maps JavaScript API and Places API (New).")
  console.log(
    "  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<browser key restricted by HTTP referrer and API target>"
  )
  console.log("")
  console.log("Resend:")
  console.log("  pnpm dlx resend-cli login")
  console.log("  pnpm dlx resend-cli api-keys --help")
  console.log("  RESEND_API_KEY=<re_... created/listed in Resend>")
  console.log("")
  console.log("PostHog:")
  console.log("  pnpm dlx @posthog/cli login")
  console.log("  POSTHOG_PROJECT_KEY=<project key from project settings/API>")
  console.log("  POSTHOG_HOST=https://eu.i.posthog.com")
  console.log("  ANALYTICS_PSEUDONYM_SECRET=<dedicated 32+ character secret>")
  console.log(
    "  ANALYTICS_EXTERNAL_PROCESSING_MODE=pseudonymous enables server-side pseudonymous processing."
  )
  console.log("")
  console.log("Vercel:")
  console.log("  pnpm dlx vercel link")
  console.log("  pnpm dlx vercel env pull .env.local")
  console.log("  pnpm dlx vercel env add <NAME> production")
  console.log("  pnpm env:push-vercel production --replace")
  console.log("")
  console.log("After exporting values in your shell, write .env.local with:")
  console.log("  pnpm env:write-local")
  console.log("")
  console.log("To merge Supabase keys directly into .env.local:")
  console.log("  pnpm env:pull-supabase <project-ref>")
  console.log("")
  console.log("To merge a Resend key from your shell without printing it:")
  console.log("  RESEND_API_KEY=re_... pnpm env:set-resend")
  console.log("")
  console.log(
    "To merge server-side pseudonymous PostHog values without printing secrets:"
  )
  console.log(
    "  POSTHOG_PROJECT_KEY=phc_... POSTHOG_HOST=https://eu.i.posthog.com ANALYTICS_PSEUDONYM_SECRET=<32+ character secret> pnpm env:set-posthog"
  )
}

function writeLocalEnv() {
  const target = join(projectDir, ".env.local")

  const missing = contract
    .filter((entry) => isRequiredContractEntry(entry, process.env))
    .filter((entry) => !process.env[entry.name]?.trim())
    .map((entry) => entry.name)

  if (missing.length) {
    console.error("Missing required shell variables:")
    for (const name of missing) {
      console.error(`- ${name}`)
    }
    console.error("")
    console.error("Export them first, then run pnpm env:write-local again.")
    process.exit(1)
  }

  const lines = [
    "# Generated by pnpm env:write-local",
    "# Do not commit this file.",
    "",
  ]

  for (const entry of contract) {
    lines.push(`# ${entry.description}`)
    lines.push(
      `${entry.name}=${serializeEnvValue(process.env[entry.name] ?? "")}`
    )
    lines.push("")
  }

  try {
    writeFileSync(target, `${lines.join("\n").trimEnd()}\n`, {
      mode: 0o600,
      flag: force ? "w" : "wx",
    })
  } catch (error) {
    if (!force && error?.code === "EEXIST") {
      console.error(
        ".env.local already exists. Re-run with --force to overwrite."
      )
      process.exit(1)
    }

    throw error
  }

  console.log("Wrote .env.local from current shell variables.")
  console.log("Run pnpm env:check to validate it.")
}

function pullSupabase() {
  const projectRef = process.argv[3]?.trim()

  if (!projectRef || projectRef.startsWith("--")) {
    console.error("Usage: pnpm env:pull-supabase <project-ref>")
    process.exit(1)
  }

  const result = spawnSync(
    "pnpm",
    [
      "dlx",
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      projectRef,
      "--output",
      "json",
    ],
    {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  )

  if (result.status !== 0) {
    console.error("Unable to pull Supabase API keys.")
    if (result.stderr.trim()) {
      console.error(result.stderr.trim())
    }
    process.exit(result.status ?? 1)
  }

  const parsed = parseJsonFromOutput(result.stdout)
  const anonKey = findSupabaseKey(parsed, "anon")
  const serviceRoleKey = findSupabaseKey(parsed, "service_role")

  if (!anonKey || !serviceRoleKey) {
    console.error(
      "Supabase API key output did not include anon and service_role keys."
    )
    process.exit(1)
  }

  mergeLocalEnv({
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  })

  console.log("Merged Supabase values into .env.local:")
  console.log("- NEXT_PUBLIC_SUPABASE_URL")
  console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY")
  console.log("- SUPABASE_SERVICE_ROLE_KEY")
  console.log("Run pnpm env:check after the remaining provider values are set.")
}

function setResend() {
  const resendKey = process.env.RESEND_API_KEY?.trim()

  if (!resendKey) {
    console.error("Set RESEND_API_KEY in your shell first.")
    console.error("Example: RESEND_API_KEY=re_... pnpm env:set-resend")
    process.exit(1)
  }

  if (!resendKey.startsWith("re_")) {
    console.error("RESEND_API_KEY should start with re_.")
    process.exit(1)
  }

  mergeLocalEnv({ RESEND_API_KEY: resendKey })
  console.log("Merged RESEND_API_KEY into .env.local.")
  console.log("Run pnpm env:check to validate the full contract.")
}

function setPostHog() {
  const postHogKey = process.env.POSTHOG_PROJECT_KEY?.trim()
  const postHogHost =
    process.env.POSTHOG_HOST?.trim() ||
    readPostHogCliHost() ||
    "https://eu.i.posthog.com"
  const pseudonymSecret = process.env.ANALYTICS_PSEUDONYM_SECRET?.trim()

  if (!postHogKey) {
    console.error("Set POSTHOG_PROJECT_KEY in your shell first.")
    console.error(
      "Example: POSTHOG_PROJECT_KEY=phc_... POSTHOG_HOST=https://eu.i.posthog.com ANALYTICS_PSEUDONYM_SECRET=<32+ character secret> pnpm env:set-posthog"
    )
    process.exit(1)
  }

  if (!postHogKey.startsWith("phc_")) {
    console.error("POSTHOG_PROJECT_KEY should start with phc_.")
    console.error("Do not use a personal API token that starts with phx_.")
    process.exit(1)
  }

  if (!pseudonymSecret || pseudonymSecret.length < 32) {
    console.error(
      "Set ANALYTICS_PSEUDONYM_SECRET to a dedicated secret of at least 32 characters."
    )
    process.exit(1)
  }

  if (!isSafePostHogHost(postHogHost)) {
    console.error(
      "POSTHOG_HOST must be an HTTPS origin, or local HTTP origin, without credentials, path, query, or fragment."
    )
    process.exit(1)
  }

  mergeLocalEnv({
    ANALYTICS_EXTERNAL_PROCESSING_MODE: pseudonymousAnalyticsMode,
    POSTHOG_PROJECT_KEY: postHogKey,
    POSTHOG_HOST: normalizePostHogHost(postHogHost),
    ANALYTICS_PSEUDONYM_SECRET: pseudonymSecret,
  })
  console.log(
    "Merged server-side pseudonymous PostHog settings into .env.local:"
  )
  console.log("- ANALYTICS_EXTERNAL_PROCESSING_MODE")
  console.log("- POSTHOG_PROJECT_KEY")
  console.log("- POSTHOG_HOST")
  console.log("- ANALYTICS_PSEUDONYM_SECRET")
  console.log("Run pnpm env:check to validate the full contract.")
}

function pushVercelEnv() {
  const environment = parseVercelEnvironment()
  const replace = process.argv.includes("--replace")
  const source = join(projectDir, ".env.local")

  if (!existsSync(source)) {
    console.error(".env.local does not exist. Pull or write local env first.")
    process.exit(1)
  }

  const localValues = parseEnvFile(source)
  const names = contract
    .map((entry) => entry.name)
    .filter((name) => localValues[name]?.trim())

  const missing = contract
    .filter(
      (entry) =>
        isRequiredContractEntry(entry, localValues) ||
        (environment === "production" && entry.name === "NEXT_PUBLIC_APP_URL")
    )
    .filter((entry) => !localValues[entry.name]?.trim())
    .map((entry) => entry.name)

  if (missing.length) {
    console.error("Cannot push incomplete local env. Missing:")
    for (const name of missing) {
      console.error(`- ${name}`)
    }
    process.exit(1)
  }

  if (!names.length) {
    console.error("No contract values found in .env.local.")
    process.exit(1)
  }

  assertVercelProductionEnvSafe(environment, localValues)

  const existingNames = readVercelEnvNames(environment)
  const pushed = []
  const skipped = []

  for (const name of names) {
    const exists = existingNames.has(name)

    if (exists && !replace) {
      skipped.push(name)
      continue
    }

    if (exists) {
      removeVercelEnv(name, environment)
    }

    addVercelEnv(name, localValues[name], environment)
    pushed.push(name)
  }

  console.log(`Vercel ${environment} env sync complete.`)

  if (pushed.length) {
    console.log(`Added/replaced: ${pushed.join(", ")}`)
  }

  if (skipped.length) {
    console.log(`Skipped existing: ${skipped.join(", ")}`)
    console.log("Re-run with --replace to rotate existing values.")
  }
}

function assertVercelProductionEnvSafe(environment, localValues) {
  if (environment !== "production") return

  const appUrl = localValues.NEXT_PUBLIC_APP_URL?.trim()

  if (!appUrl) {
    console.error("Production NEXT_PUBLIC_APP_URL is required.")
    process.exit(1)
  }

  let url

  try {
    url = new URL(appUrl)
  } catch {
    console.error("Production NEXT_PUBLIC_APP_URL must be a valid HTTPS URL.")
    process.exit(1)
  }

  if (url.protocol !== "https:" || isLocalHost(url.hostname)) {
    console.error(
      "Production NEXT_PUBLIC_APP_URL must be a public HTTPS origin, not localhost or a private network URL."
    )
    console.error(
      "Set NEXT_PUBLIC_APP_URL=https://nabaperks.com before pushing production env."
    )
    process.exit(1)
  }
}

function isLocalHost(hostname) {
  const host = hostname.toLowerCase()

  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  )
}

function mergeLocalEnv(updates) {
  const target = join(projectDir, ".env.local")
  const existing = readEnvFileIfPresent(target)
  const merged = { ...existing, ...updates }
  const names = contract.map((entry) => entry.name)
  const extraNames = Object.keys(merged).filter((name) => !names.includes(name))
  const lines = [
    "# Generated by Nabaperks env helpers.",
    "# Do not commit this file.",
    "",
  ]

  for (const entry of contract) {
    lines.push(`# ${entry.description}`)
    lines.push(`${entry.name}=${serializeEnvValue(merged[entry.name] ?? "")}`)
    lines.push("")
  }

  for (const name of extraNames.sort()) {
    lines.push(`${name}=${serializeEnvValue(merged[name])}`)
  }

  writeFileSync(target, `${lines.join("\n").trimEnd()}\n`, { mode: 0o600 })
}

function readEnvFileIfPresent(path) {
  try {
    return parseEnvFile(path)
  } catch (error) {
    if (error?.code === "ENOENT") return {}
    throw error
  }
}

function isRequiredContractEntry(entry, values) {
  if (
    values.ANALYTICS_EXTERNAL_PROCESSING_MODE === pseudonymousAnalyticsMode &&
    pseudonymousAnalyticsRequiredEnvNames.has(entry.name)
  ) {
    return true
  }

  if (entry.optional) return false

  return !(
    values.CUSTOMER_OTP_BYPASS_MODE?.trim() ===
      customerOtpBypassModeAnyFourDigits && twilioVerifyEnvNames.has(entry.name)
  )
}

function readPostHogCliHost() {
  const path = join(process.env.HOME ?? "", ".posthog/credentials.json")

  if (!existsSync(path)) return undefined

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"))
    return typeof parsed.host === "string" ? parsed.host : undefined
  } catch {
    return undefined
  }
}

function normalizePostHogHost(host) {
  if (host === "https://eu.posthog.com") return "https://eu.i.posthog.com"
  if (host === "https://us.posthog.com" || host === "https://app.posthog.com") {
    return "https://us.i.posthog.com"
  }

  return host
}

function isSafePostHogHost(value) {
  try {
    const url = new URL(value)
    const localHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    return (
      (url.protocol === "https:" || localHttp) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function parseEnvFile(path) {
  return parseEnvText(readFileSync(path, "utf8"))
}

function parseVercelEnvironment() {
  const environment = process.argv.slice(3).find((arg) => !arg.startsWith("--"))

  if (!environment) return "production"

  if (!["production", "preview", "development"].includes(environment)) {
    console.error(
      "Vercel environment must be production, preview, or development."
    )
    process.exit(1)
  }

  return environment
}

function readVercelEnvNames(environment) {
  const result = runVercel(["env", "ls", environment], "")

  if (result.status !== 0) {
    console.error(`Unable to list Vercel ${environment} environment variables.`)
    printVercelError(result)
    process.exit(result.status ?? 1)
  }

  const names = new Set()

  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s+/)

    if (match) names.add(match[1])
  }

  return names
}

function addVercelEnv(name, value, environment) {
  const result = runVercel(
    ["env", "add", name, environment, "--yes"],
    `${value}\n`
  )

  if (result.status !== 0) {
    console.error(`Unable to add Vercel env variable ${name}.`)
    printVercelError(result)
    process.exit(result.status ?? 1)
  }
}

function removeVercelEnv(name, environment) {
  const result = runVercel(["env", "rm", name, environment, "--yes"], "")

  if (result.status !== 0) {
    console.error(`Unable to remove existing Vercel env variable ${name}.`)
    printVercelError(result)
    process.exit(result.status ?? 1)
  }
}

function runVercel(args, input) {
  return spawnSync("pnpm", ["dlx", "vercel", ...args], {
    cwd: projectDir,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  })
}

function printVercelError(result) {
  const output = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .filter((line) => !line.includes("Linked to"))
    .join("\n")
    .trim()

  if (output) console.error(output)
}

function parseJsonFromOutput(output) {
  const start = output.indexOf("[")
  const objectStart = output.indexOf("{")
  const jsonStart =
    start === -1
      ? objectStart
      : objectStart === -1
        ? start
        : Math.min(start, objectStart)

  if (jsonStart === -1) {
    console.error("Supabase CLI returned no JSON output.")
    process.exit(1)
  }

  try {
    return JSON.parse(output.slice(jsonStart))
  } catch {
    console.error("Unable to parse Supabase CLI JSON output.")
    process.exit(1)
  }
}

function findSupabaseKey(value, keyName) {
  const candidates = Array.isArray(value) ? value : Object.values(value ?? {})

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue

    const label = String(
      candidate.name ??
        candidate.key ??
        candidate.type ??
        candidate.prefix ??
        ""
    ).toLowerCase()

    if (!label.includes(keyName)) continue

    for (const field of ["api_key", "apiKey", "value", "secret", "key"]) {
      const maybeKey = candidate[field]

      if (typeof maybeKey === "string" && maybeKey.length > 20) {
        return maybeKey
      }
    }
  }

  return undefined
}

function available(binary) {
  const result = spawnSync("zsh", ["-lc", `command -v ${binary}`], {
    stdio: "ignore",
  })

  return result.status === 0
}
