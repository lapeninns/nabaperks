export type EnvVisibility = "public" | "server"

export type EnvKind = "string" | "url"

export type EnvContractEntry = {
  name: string
  visibility: EnvVisibility
  kind: EnvKind
  description: string
  optional?: boolean
}

const customerOtpBypassModeAnyFourDigits = "any-4-digits"
const twilioVerifyEnvNames = new Set([
  "TWILIO_ACCOUNT_SID",
  "TWILIO_VERIFY_SERVICE_SID",
])

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
  const customerOtpTwilioBypassed =
    customerOtpBypassMode === customerOtpBypassModeAnyFourDigits

  for (const entry of contract) {
    const value = values[entry.name]?.trim()

    if (!value) {
      if (canSkipMissingEntry(entry, customerOtpTwilioBypassed)) continue

      missing.push(entry.name)
      continue
    }

    invalid.push(...validateEnvEntry(entry, value))
  }

  invalid.push(...validateCustomerOtpBypassMode(customerOtpBypassMode))

  if (missing.length || invalid.length) {
    throw new EnvConfigError({ missing, invalid })
  }
}

function canSkipMissingEntry(
  entry: EnvContractEntry,
  customerOtpTwilioBypassed: boolean
) {
  return (
    entry.optional ||
    (customerOtpTwilioBypassed && twilioVerifyEnvNames.has(entry.name))
  )
}

function validateEnvEntry(entry: EnvContractEntry, value: string) {
  return [
    ...validateEnvVisibility(entry),
    ...validateEnvUrl(entry.name, entry.kind, value),
  ]
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
  if (kind !== "url") return []

  try {
    const url = new URL(value)

    return ["http:", "https:"].includes(url.protocol)
      ? []
      : [`${name} must use http or https`]
  } catch {
    return [`${name} must be a valid URL`]
  }
}

function validateCustomerOtpBypassMode(mode: string | undefined) {
  if (!mode || mode === customerOtpBypassModeAnyFourDigits) return []

  return [
    `CUSTOMER_OTP_BYPASS_MODE must be ${customerOtpBypassModeAnyFourDigits} or blank`,
  ]
}
