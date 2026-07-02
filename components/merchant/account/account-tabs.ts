/**
 * Shared definitions for the merchant Account hub tabs.
 *
 * Pure module (no directives, no imports) so both the server hub page and the
 * client tab bar can depend on it, and tests can exercise tab validation
 * without pulling React or server-only code.
 */

export const ACCOUNT_TABS = [
  { id: "profile", label: "Profile" },
  { id: "billing", label: "Billing" },
  { id: "locations", label: "Locations" },
] as const

export type AccountTab = (typeof ACCOUNT_TABS)[number]["id"]

export const DEFAULT_ACCOUNT_TAB: AccountTab = "profile"

export type AccountSearchParamValue = string | readonly string[] | undefined

export type AccountSearchParams = {
  readonly tab?: AccountSearchParamValue
  readonly checkout?: AccountSearchParamValue
  readonly portal?: AccountSearchParamValue
  readonly locations?: AccountSearchParamValue
  readonly [key: string]: AccountSearchParamValue
}

export type AccountOutcomeParams = {
  checkout?: string
  portal?: string
}

export function isAccountTab(value: string | undefined): value is AccountTab {
  return ACCOUNT_TABS.some((tab) => tab.id === value)
}

export function firstAccountSearchParamValue(
  value: AccountSearchParamValue
): string | undefined {
  return typeof value === "string" ? value : value?.[0]
}

/** Resolve a raw `?tab=` value to a known tab, defaulting to Profile. */
export function resolveAccountTab(value: AccountSearchParamValue): AccountTab {
  const candidate = firstAccountSearchParamValue(value)
  return isAccountTab(candidate) ? candidate : DEFAULT_ACCOUNT_TAB
}

export function resolveAccountOutcomeParams(
  params: Pick<AccountSearchParams, "checkout" | "portal">
): AccountOutcomeParams {
  const checkout = firstAccountSearchParamValue(params.checkout)
  const portal = firstAccountSearchParamValue(params.portal)
  const result: AccountOutcomeParams = {}

  if (checkout) result.checkout = checkout
  if (portal) result.portal = portal

  return result
}
