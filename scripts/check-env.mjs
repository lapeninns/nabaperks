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
  "PRODUCTION_MONITOR_SECRET",
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
const highEntropySecretEnvNames = new Set([
  "ANALYTICS_PSEUDONYM_SECRET",
  "CRON_SECRET",
  "PRODUCTION_MONITOR_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "CUSTOMER_PHONE_HMAC_SECRET",
  "CUSTOMER_PHONE_ENCRYPTION_KEY",
  "CUSTOMER_EMAIL_HMAC_SECRET",
  "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY",
  "SUPABASE_SEND_EMAIL_HOOK_SECRET",
  "SUPABASE_SEND_SMS_HOOK_SECRET",
])
const standardWebhookSecretEnvNames = new Set([
  "SUPABASE_SEND_EMAIL_HOOK_SECRET",
  "SUPABASE_SEND_SMS_HOOK_SECRET",
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

if (hostedOrProductionProfile) {
  const supabaseUrl = values.NEXT_PUBLIC_SUPABASE_URL?.trim()

  if (supabaseUrl && !isSafeSupabaseProjectOrigin(supabaseUrl)) {
    invalid.push(
      "NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project origin without credentials, path, query, or fragment"
    )
  }

  const vapidPrivateKey = values.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
  const vapidPublicKey = values.WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
  const vapidSubject = values.WEB_PUSH_VAPID_SUBJECT?.trim()
  const configuredVapidValues = [
    vapidPrivateKey,
    vapidPublicKey,
    vapidSubject,
  ].filter(Boolean).length

  if (configuredVapidValues > 0 && configuredVapidValues < 3) {
    invalid.push("Web Push VAPID values must be configured together")
  }

  if (vapidPrivateKey && !hasVapidKeyShape(vapidPrivateKey, 32)) {
    invalid.push(
      "WEB_PUSH_VAPID_PRIVATE_KEY must be an unpadded URL-safe Base64 value decoding to 32 bytes"
    )
  }

  if (vapidPublicKey && !hasVapidKeyShape(vapidPublicKey, 65)) {
    invalid.push(
      "WEB_PUSH_VAPID_PUBLIC_KEY must be an unpadded URL-safe Base64 value decoding to 65 bytes"
    )
  }

  if (vapidSubject && !isValidVapidSubject(vapidSubject)) {
    invalid.push("WEB_PUSH_VAPID_SUBJECT must be an HTTPS URL or mailto URI")
  }

  for (const name of highEntropySecretEnvNames) {
    const secret = values[name]?.trim()
    if (!secret) continue

    if (secret.length < 32) {
      invalid.push(`${name} must be at least 32 characters`)
      continue
    }

    if (/(?:change.?me|example|placeholder|replace.?me)/i.test(secret)) {
      invalid.push(`${name} must not be a placeholder`)
    }

    if (!hasHighEntropySecretShape(secret)) {
      invalid.push(`${name} must use a generated high-entropy value`)
    }

    if (
      standardWebhookSecretEnvNames.has(name) &&
      !hasStandardWebhookSecretShape(secret)
    ) {
      invalid.push(
        `${name} must use Standard Webhooks v1,whsec_<base64> format`
      )
    }
  }

  const cronSecret = values.CRON_SECRET?.trim()
  const monitorSecret = values.PRODUCTION_MONITOR_SECRET?.trim()

  if (cronSecret && monitorSecret && cronSecret === monitorSecret) {
    invalid.push("PRODUCTION_MONITOR_SECRET must differ from CRON_SECRET")
  }
}

if (customerOtpBypassMode && !customerOtpTwilioBypassed) {
  invalid.push(
    `CUSTOMER_OTP_BYPASS_MODE must be ${customerOtpBypassModeAnyFourDigits} or blank`
  )
}

if (hostedOrProductionProfile && customerOtpTwilioBypassed) {
  invalid.push(
    "CUSTOMER_OTP_BYPASS_MODE must be blank outside local development"
  )
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

function hasHighEntropySecretShape(secret) {
  if (/\s/.test(secret) || new Set(secret).size < 12) return false

  const compact = secret.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (
    /(?:0123456789|123456789|9876543210|abcdef|fedcba|qwerty)/.test(compact)
  ) {
    return false
  }

  for (
    let period = 1;
    period <= Math.min(16, Math.floor(secret.length / 2));
    period += 1
  ) {
    if (
      secret.length % period === 0 &&
      secret === secret.slice(0, period).repeat(secret.length / period)
    ) {
      return false
    }
  }

  const structuredChunks = secret.match(/[A-Z][a-z]\d[^A-Za-z\d]/g)
  if (
    structuredChunks &&
    structuredChunks.length >= 4 &&
    structuredChunks.join("") === secret &&
    structuredChunks.every(
      (chunk) => chunk[0].toLowerCase() === chunk[1].toLowerCase()
    )
  ) {
    const letters = structuredChunks.map((chunk) => chunk.charCodeAt(0))
    const digits = structuredChunks.map((chunk) => Number(chunk[2]))
    const sequentialLetters = letters.every(
      (letter, index) => index === 0 || letter === letters[index - 1] + 1
    )
    const sequentialDigits = digits.every(
      (digit, index) => index === 0 || digit === digits[index - 1] + 1
    )

    if (sequentialLetters || sequentialDigits) return false
  }

  return true
}

function hasStandardWebhookSecretShape(secret) {
  const match = /^v1,whsec_([A-Za-z0-9+/_-]+={0,2})$/.exec(secret)
  if (!match) return false

  const payload = match[1].replace(/-/g, "+").replace(/_/g, "/")
  if (payload.length % 4 === 1) return false

  try {
    return Buffer.from(payload, "base64").length >= 32
  } catch {
    return false
  }
}

function hasVapidKeyShape(value, decodedBytes) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false

  try {
    const decoded = Buffer.from(value, "base64url")
    return (
      decoded.length === decodedBytes &&
      decoded.toString("base64url") === value
    )
  } catch {
    return false
  }
}

function isValidVapidSubject(value) {
  try {
    const subject = new URL(value)
    return ["https:", "mailto:"].includes(subject.protocol)
  } catch {
    return false
  }
}

function isSafeSupabaseProjectOrigin(value) {
  try {
    const url = new URL(value)
    const labels = url.hostname.toLowerCase().split(".")
    const hostedProject =
      labels.length === 3 &&
      labels[1] === "supabase" &&
      labels[2] === "co" &&
      /^[a-z0-9-]+$/.test(labels[0])

    return (
      url.protocol === "https:" &&
      hostedProject &&
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
