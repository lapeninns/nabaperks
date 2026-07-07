/**
 * Allowlisted return paths for Stripe checkout and portal sessions started
 * from merchant billing surfaces.
 */
export const BILLING_LAUNCH_TAB_PATH = "/app/launch?tab=billing"
export const BILLING_ACCOUNT_PATH = "/app/billing"

const BILLING_RETURN_ALLOWLIST: ReadonlySet<string> = new Set([
  BILLING_LAUNCH_TAB_PATH,
  BILLING_ACCOUNT_PATH,
])

/** Resolve a posted `returnTo` value to an allowlisted billing return path. */
export function resolveBillingReturnBase(
  value: FormDataEntryValue | null
): string {
  return typeof value === "string" && BILLING_RETURN_ALLOWLIST.has(value)
    ? value
    : BILLING_ACCOUNT_PATH
}

/** Append query params to a base that may already carry search params. */
export function billingReturnHref(
  base: string,
  query: Record<string, string>
): string {
  const params = new URLSearchParams(
    base.includes("?") ? base.slice(base.indexOf("?") + 1) : undefined
  )

  for (const [key, value] of Object.entries(query)) {
    params.set(key, value)
  }

  const pathname = base.includes("?") ? base.slice(0, base.indexOf("?")) : base
  const serialized = params.toString()

  return serialized ? `${pathname}?${serialized}` : pathname
}
