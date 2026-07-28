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

  if (missing.length || invalid.length) {
    throw new EnvConfigError({ missing, invalid })
  }
}

function validateEnvEntry(entry: EnvContractEntry, value: string) {
  return [
    ...validateEnvVisibility(entry),
    ...validateEnvUrl(entry.name, entry.kind, value),
    ...validateStripeTestMode(entry.name, value),
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

function validateStripeTestMode(name: string, value: string) {
  if (
    name === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" &&
    !value.startsWith("pk_test_")
  ) {
    return [
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must use a Stripe test-mode pk_test_ key",
    ]
  }

  if (name === "STRIPE_SECRET_KEY" && !value.startsWith("sk_test_")) {
    return ["STRIPE_SECRET_KEY must use a Stripe test-mode sk_test_ key"]
  }

  return []
}

function validateCustomerOtpBypassMode(mode: string | undefined) {
  if (!mode || mode === customerOtpBypassModeAnyFourDigits) return []

  return [
    `CUSTOMER_OTP_BYPASS_MODE must be ${customerOtpBypassModeAnyFourDigits} or blank`,
  ]
}
