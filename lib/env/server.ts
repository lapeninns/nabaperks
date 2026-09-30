import "server-only"

import envContract from "@/config/env-contract.json"
import { isCustomerEmailAuthMode } from "@/lib/customer/email-auth-mode"
import { assertValidEnv, type EnvContractEntry } from "@/lib/env/validate"
import { logger } from "@/lib/observability/logger"

let invalidEmailAuthModeWarned = false

export function getServerEnv() {
  const values = Object.fromEntries(
    (envContract as EnvContractEntry[]).map((entry) => [
      entry.name,
      process.env[entry.name],
    ])
  )

  assertValidEnv(envContract as EnvContractEntry[], values)
  warnOnceOnInvalidEmailAuthMode(values.CUSTOMER_EMAIL_AUTH_MODE)

  return values as Record<(typeof envContract)[number]["name"], string>
}

/**
 * An unrecognised CUSTOMER_EMAIL_AUTH_MODE runs as `off` (the parser's rule),
 * so it must not fail the request path; the deploy gate rejects it. Said once
 * per process, naming the setting but never its value.
 */
function warnOnceOnInvalidEmailAuthMode(raw: string | undefined) {
  const mode = raw?.trim() ?? ""
  if (!mode || isCustomerEmailAuthMode(mode) || invalidEmailAuthModeWarned) {
    return
  }
  invalidEmailAuthModeWarned = true
  logger.warn("config.invalid_email_auth_mode", {
    name: "CUSTOMER_EMAIL_AUTH_MODE",
    resolvedMode: "off",
  })
}
