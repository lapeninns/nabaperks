import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const projectDir = process.cwd()
const nodeEnv = process.env.NODE_ENV || "development"
const checkProfile = parseCheckProfile(
  process.argv.slice(2),
  process.env.VERCEL_ENV
)
const envContract = JSON.parse(
  readFileSync(join(projectDir, "config/env-contract.json"), "utf8")
)
const productionRequiredEnvNames = new Set([
  "CRON_SECRET",
  "RESEND_FROM",
  "SUPABASE_SEND_EMAIL_HOOK_SECRET",
  "STRIPE_GROWTH_ANNUAL_PRICE_ID",
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  "WEB_PUSH_VAPID_PUBLIC_KEY",
  "WEB_PUSH_VAPID_SUBJECT",
])
const pseudonymousAnalyticsMode = "pseudonymous"
const pseudonymousAnalyticsRequiredEnvNames = new Set([
  "POSTHOG_PROJECT_KEY",
  "POSTHOG_HOST",
  "ANALYTICS_PSEUDONYM_SECRET",
])

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
const customerOtpBypassMode = values.CUSTOMER_OTP_BYPASS_MODE?.trim()
const customerOtpBypassModeAnyFourDigits = "any-4-digits"
const customerOtpTwilioBypassed =
  customerOtpBypassMode === customerOtpBypassModeAnyFourDigits
const customerDevOtpCode = values.CUSTOMER_DEV_OTP_CODE?.trim()
const hostedVercelEnvironment = ["preview", "production"].includes(
  values.VERCEL_ENV?.trim()
)
const hostedOrProductionProfile =
  checkProfile === "production" || hostedVercelEnvironment
const twilioVerifyEnvNames = new Set([
  "TWILIO_ACCOUNT_SID",
  "TWILIO_VERIFY_SERVICE_SID",
])
const pseudonymousAnalyticsEnabled =
  values.ANALYTICS_EXTERNAL_PROCESSING_MODE === pseudonymousAnalyticsMode

for (const entry of envContract) {
  const value = values[entry.name]?.trim()
  const requiredByProfile =
    checkProfile === "production" && productionRequiredEnvNames.has(entry.name)
  const requiredByAnalytics =
    pseudonymousAnalyticsEnabled &&
    pseudonymousAnalyticsRequiredEnvNames.has(entry.name)

  if (!value) {
    if (
      (!requiredByProfile && !requiredByAnalytics && entry.optional) ||
      (customerOtpTwilioBypassed && twilioVerifyEnvNames.has(entry.name))
    ) {
      continue
    }
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

if (pseudonymousAnalyticsEnabled) {
  const projectKey = values.POSTHOG_PROJECT_KEY?.trim()
  const postHogHost = values.POSTHOG_HOST?.trim()
  const pseudonymSecret = values.ANALYTICS_PSEUDONYM_SECRET?.trim()

  if (projectKey && !projectKey.startsWith("phc_")) {
    invalid.push("POSTHOG_PROJECT_KEY must start with phc_")
  }

  if (pseudonymSecret && pseudonymSecret.length < 32) {
    invalid.push("ANALYTICS_PSEUDONYM_SECRET must be at least 32 characters")
  }

  if (postHogHost && !isSafePostHogHost(postHogHost)) {
    invalid.push(
      "POSTHOG_HOST must be an HTTPS origin, or local HTTP origin, without credentials, path, query, or fragment"
    )
  }
}

if (customerOtpBypassMode && !customerOtpTwilioBypassed) {
  invalid.push(
    `CUSTOMER_OTP_BYPASS_MODE must be ${customerOtpBypassModeAnyFourDigits} or blank`
  )
}

if (hostedOrProductionProfile && customerOtpTwilioBypassed) {
  invalid.push("CUSTOMER_OTP_BYPASS_MODE must be blank outside local development")
}

if (hostedOrProductionProfile && customerDevOtpCode) {
  invalid.push("CUSTOMER_DEV_OTP_CODE must be blank outside local development")
}

if (
  !customerOtpTwilioBypassed &&
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

console.log(
  checkProfile === "production"
    ? "Nabaperks production environment configuration is valid."
    : "Nabaperks environment configuration is valid."
)

function parseCheckProfile(args, vercelEnvironment) {
  let profile =
    vercelEnvironment?.trim() === "production" ? "production" : "default"

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--production") {
      profile = "production"
      continue
    }

    if (arg === "--profile") {
      profile = args[index + 1] || ""
      index += 1
      continue
    }

    if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length)
    }
  }

  if (profile === "local" || profile === "development") return "default"
  if (profile === "default" || profile === "production") return profile

  console.error(
    "Unknown env check profile. Use --profile=production or omit the flag."
  )
  process.exit(1)
}
