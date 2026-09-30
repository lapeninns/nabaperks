import { parseCustomerEmailAuthMode } from "@/lib/customer/email-auth-mode"
import { trustedSupabaseProjectOrigin } from "@/lib/observability/readiness"

/**
 * Release pre-conditions the build depends on, reported by /api/readiness
 * (QA BUG-006, BUG-016). Each result is a closed vocabulary with no
 * customer data, so the probe can show why it is not ready.
 */

/**
 * `snapshot_missing`: the database has no enabled terms snapshot trigger for
 * the version this build records on every join, so joins would store the join
 * function's older built-in snapshot under the new version.
 */
export type LegalTermsReadiness = {
  readonly legalTerms: "ok" | "snapshot_missing" | "error"
}

type LegalTermsReadinessOptions = {
  readonly supabaseUrl: string | undefined
  readonly serviceRoleKey: string | undefined
  readonly legalVersion: string
  readonly allowLoopback?: boolean
  readonly fetcher?: typeof fetch
  readonly timeoutMs?: number
}

export async function checkLegalTermsReadiness({
  supabaseUrl,
  serviceRoleKey,
  legalVersion,
  allowLoopback = false,
  fetcher = fetch,
  timeoutMs = 3_000,
}: LegalTermsReadinessOptions): Promise<LegalTermsReadiness> {
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    return { legalTerms: "error" }
  }

  try {
    const origin = trustedSupabaseProjectOrigin(supabaseUrl, {
      allowLoopback,
    })
    if (!origin) return { legalTerms: "error" }

    const response = await fetcher(
      new URL("/rest/v1/rpc/customer_legal_terms_snapshot_installed", origin),
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_version: legalVersion }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      }
    )
    if (!response.ok) return { legalTerms: "error" }

    const installed: unknown = await response.json()
    if (installed === true) return { legalTerms: "ok" }
    if (installed === false) return { legalTerms: "snapshot_missing" }
    return { legalTerms: "error" }
  } catch {
    return { legalTerms: "error" }
  }
}

/**
 * `customer_email_hmac_missing`: email sign-in is on (`existing` or `full`)
 * but CUSTOMER_EMAIL_HMAC_SECRET is blank, so every email code send is
 * refused. The deploy gate (scripts/check-env.mjs) refuses this pairing; this
 * reports it if a runtime change slips past the gate.
 */
export type ConfigurationReadiness = {
  readonly configuration: "ok" | "customer_email_hmac_missing"
}

export function checkConfigurationReadiness(
  env: Record<string, string | undefined>
): ConfigurationReadiness {
  const emailMode = parseCustomerEmailAuthMode(env.CUSTOMER_EMAIL_AUTH_MODE)
  if (emailMode !== "off" && !env.CUSTOMER_EMAIL_HMAC_SECRET?.trim()) {
    return { configuration: "customer_email_hmac_missing" }
  }
  return { configuration: "ok" }
}
