export type EnvVisibility = "public" | "server"

export type EnvKind = "string" | "url" | "postgres-url"

export type EnvContractEntry = {
  name: string
  visibility: EnvVisibility
  kind: EnvKind
  description: string
  optional?: boolean
}

const customerOtpBypassModeAnyFourDigits = "any-4-digits"

export class EnvConfigError extends Error {
  readonly missing: string[]
  readonly invalid: string[]

  constructor({ missing, invalid }: { missing: string[]; invalid: string[] }) {
    const details = [
      missing.length ? `missing: ${missing.join(", ")}` : "",
      invalid.length ? `invalid: ${invalid.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ")

    super(
      `Nabaperks environment configuration is incomplete${
        details ? ` (${details})` : ""
      }. Copy .env.example to .env.local and fill the required values.`
    )

    this.name = "EnvConfigError"
    this.missing = missing
    this.invalid = invalid
  }
}

export function assertValidEnv(
  contract: readonly EnvContractEntry[],
  values: Record<string, string | undefined>
) {
  const missing: string[] = []
  const invalid: string[] = []
  const customerOtpBypassMode = values.CUSTOMER_OTP_BYPASS_MODE?.trim()

  for (const entry of contract) {
    const value = values[entry.name]?.trim()

    if (!value) {
      if (entry.optional) continue

      missing.push(entry.name)
      continue
    }

    invalid.push(...validateEnvEntry(entry, value))
  }

  invalid.push(...validateCustomerOtpBypassMode(customerOtpBypassMode))
  invalid.push(...validateCustomerMessaging(values))

  if (missing.length || invalid.length) {
    throw new EnvConfigError({ missing, invalid })
  }
}

function validateCustomerMessaging(values: Record<string, string | undefined>) {
  const invalid: string[] = []
  const mode = values.CUSTOMER_MESSAGING_MODE?.trim() || "off"
  const bypass = values.CUSTOMER_MESSAGING_BYPASS_MODE?.trim()

  if (!["off", "dry_run", "live"].includes(mode)) {
    invalid.push("CUSTOMER_MESSAGING_MODE must be off, dry_run or live")
  }
  if (bypass && bypass !== "log") {
    invalid.push("CUSTOMER_MESSAGING_BYPASS_MODE must be log or blank")
  }
  if (mode !== "off") {
    for (const name of [
      "TWILIO_AUTH_TOKEN",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_CUSTOMER_MESSAGING_SERVICE_SID",
      "TWILIO_CONTENT_SIDS",
    ]) {
      if (!values[name]?.trim())
        invalid.push(`${name} is required when customer messaging is enabled`)
    }
  }
  const contentSids = values.TWILIO_CONTENT_SIDS?.trim()
  if (contentSids && !hasTwilioContentSidMapShape(contentSids)) {
    invalid.push("TWILIO_CONTENT_SIDS must be a JSON object of HX Content SIDs")
  } else if (mode !== "off" && contentSids) {
    const missingTemplates = missingTwilioContentSids(contentSids)
    if (missingTemplates.length > 0) {
      invalid.push(
        `TWILIO_CONTENT_SIDS is missing approved templates for: ${missingTemplates.join(", ")}`
      )
    }
  }
  return invalid
}

function missingTwilioContentSids(value: string) {
  const parsed = JSON.parse(value) as Record<string, string>
  return customerMessagingContentEvents.filter(
    (eventType) => !parsed[eventType]
  )
}

function hasTwilioContentSidMapShape(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.entries(parsed).every(
        ([eventType, sid]) =>
          /^[a-z][a-z0-9_]*$/.test(eventType) &&
          typeof sid === "string" &&
          /^HX[0-9a-f]{32}$/i.test(sid)
      )
    )
  } catch {
    return false
  }
}

function validateEnvEntry(entry: EnvContractEntry, value: string) {
  return [
    ...validateEnvVisibility(entry),
    ...validateEnvUrl(entry.name, entry.kind, value),
    ...validateCustomerSessionSecret(entry.name, value),
  ]
}

function validateCustomerSessionSecret(name: string, value: string) {
  if (name !== "CUSTOMER_SESSION_SECRET") return []
  return isStrongCustomerSessionSecret(value)
    ? []
    : ["CUSTOMER_SESSION_SECRET must use a generated high-entropy value"]
}

function validateEnvVisibility(entry: EnvContractEntry) {
  if (entry.visibility === "public" && !entry.name.startsWith("NEXT_PUBLIC_")) {
    return [`${entry.name} must be prefixed with NEXT_PUBLIC_`]
  }

  if (entry.visibility === "server" && entry.name.startsWith("NEXT_PUBLIC_")) {
    return [`${entry.name} must not be prefixed with NEXT_PUBLIC_`]
  }

  return []
}

function validateEnvUrl(name: string, kind: EnvKind, value: string) {
  if (kind !== "url" && kind !== "postgres-url") return []

  try {
    const url = new URL(value)
    const allowedProtocols =
      kind === "postgres-url"
        ? ["postgres:", "postgresql:"]
        : ["http:", "https:"]

    return allowedProtocols.includes(url.protocol)
      ? []
      : [`${name} must use ${describeAllowedProtocols(kind)}`]
  } catch {
    return [`${name} must be a valid URL`]
  }
}

function describeAllowedProtocols(kind: EnvKind) {
  return kind === "postgres-url" ? "postgres or postgresql" : "http or https"
}

function validateCustomerOtpBypassMode(mode: string | undefined) {
  if (!mode || mode === customerOtpBypassModeAnyFourDigits) return []

  return [
    `CUSTOMER_OTP_BYPASS_MODE must be ${customerOtpBypassModeAnyFourDigits} or blank`,
  ]
}
import { isStrongCustomerSessionSecret } from "@/lib/security/customer-session-secret-core"
import customerMessagingContentEvents from "@/config/customer-messaging-content-events.json" with { type: "json" }
