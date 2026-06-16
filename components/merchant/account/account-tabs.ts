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
] as const

export type AccountTab = (typeof ACCOUNT_TABS)[number]["id"]

export const DEFAULT_ACCOUNT_TAB: AccountTab = "profile"

export function isAccountTab(value: string | undefined): value is AccountTab {
  return ACCOUNT_TABS.some((tab) => tab.id === value)
}

/** Resolve a raw `?tab=` value to a known tab, defaulting to Profile. */
export function resolveAccountTab(value: string | undefined): AccountTab {
  return isAccountTab(value) ? value : DEFAULT_ACCOUNT_TAB
}
