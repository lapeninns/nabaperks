import "server-only"

/**
 * Server-controlled rollout mode for customer email sign-in
 * (`CUSTOMER_EMAIL_AUTH_MODE`):
 *
 * - `off` (default): email opens no wallet; email is collected for reward
 *   collection only.
 * - `existing`: email opens a wallet that already holds that verified email,
 *   but never creates one.
 * - `full`: email can also start a new wallet from the join page.
 *
 * Only the server reads this. A client component receives the resolved mode
 * (or copy chosen from it) as a prop, never the environment variable.
 *
 * Rollout guard: `existing` and `full` change guest copy (the prompts' Wi-Fi
 * sign-in reason and the conflict message) before this build can sign anyone
 * in by email. Keep the mode `off` in an environment until the build with the
 * email sign-in and email join flows is live there (production runbook,
 * "Customer email sign-in mode").
 */
export const CUSTOMER_EMAIL_AUTH_MODES = ["off", "existing", "full"] as const

export type CustomerEmailAuthMode = (typeof CUSTOMER_EMAIL_AUTH_MODES)[number]

/**
 * Parses a configured value. Blank or unset is `off`; an unrecognised value is
 * also `off` so a typo can never widen sign-in. Environment validation rejects
 * unrecognised values separately, before the app serves traffic.
 */
export function parseCustomerEmailAuthMode(
  raw: string | null | undefined
): CustomerEmailAuthMode {
  const value = raw?.trim() ?? ""
  return isCustomerEmailAuthMode(value) ? value : "off"
}

export function isCustomerEmailAuthMode(
  value: string
): value is CustomerEmailAuthMode {
  return (CUSTOMER_EMAIL_AUTH_MODES as readonly string[]).includes(value)
}

export function customerEmailAuthMode(
  env: Record<string, string | undefined> = process.env
): CustomerEmailAuthMode {
  return parseCustomerEmailAuthMode(env.CUSTOMER_EMAIL_AUTH_MODE)
}

/** Email can open an existing wallet that holds that verified email. */
export function emailSignInEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return customerEmailAuthMode(env) !== "off"
}

/** Email can also start a new wallet (join page only). */
export function emailWalletCreationEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return customerEmailAuthMode(env) === "full"
}

/**
 * Why the "add your email" prompts ask: to collect rewards while email sign-in
 * is off, and to sign in over Wi-Fi once email can open a wallet.
 */
export function emailPromptReason(
  env: Record<string, string | undefined> = process.env
): "rewards" | "wifi_sign_in" {
  return emailSignInEnabled(env) ? "wifi_sign_in" : "rewards"
}
