export type MerchantRecoveryRevocationStatus = "local" | "admin" | "unconfirmed"

export type MerchantRecoveryCleanupFailure = Readonly<{
  phase: "local-revocation" | "admin-revocation" | "browser-clear"
  kind: "returned-error" | "threw"
}>

type MerchantRecoveryRevocationResult = void | Readonly<{
  error?: unknown | null
}>

export type MerchantRecoverySessionCleanupDependencies = Readonly<{
  signOutLocal: () => Promise<MerchantRecoveryRevocationResult>
  signOutAdminLocal: (
    accessToken: string
  ) => Promise<MerchantRecoveryRevocationResult>
  clearBrowserCredentials: () => Promise<void>
  onSafeFailure?: (failure: MerchantRecoveryCleanupFailure) => void
}>

export type MerchantRecoverySessionCleanupResult = Readonly<{
  revocation: MerchantRecoveryRevocationStatus
  browserCredentialsCleared: true
}>

const BROWSER_CLEAR_FAILURE_MESSAGE =
  "Unable to close the failed password-reset session safely."

/**
 * Closes a failed password-recovery session without coupling the policy to
 * Supabase or Next.js. Browser credentials are cleared even when server-side
 * revocation cannot be confirmed.
 *
 * The diagnostic callback deliberately receives fixed codes only. Provider
 * errors and access tokens never leave this boundary.
 */
export async function cleanupFailedMerchantRecoverySession(
  accessToken: string | undefined,
  dependencies: MerchantRecoverySessionCleanupDependencies
): Promise<MerchantRecoverySessionCleanupResult> {
  let revocation: MerchantRecoveryRevocationStatus = "unconfirmed"

  try {
    const result = await dependencies.signOutLocal()
    if (revocationFailed(result)) {
      reportSafeFailure(dependencies, {
        phase: "local-revocation",
        kind: "returned-error",
      })
    } else {
      revocation = "local"
    }
  } catch {
    reportSafeFailure(dependencies, {
      phase: "local-revocation",
      kind: "threw",
    })
  }

  if (revocation === "unconfirmed" && accessToken) {
    try {
      const result = await dependencies.signOutAdminLocal(accessToken)
      if (revocationFailed(result)) {
        reportSafeFailure(dependencies, {
          phase: "admin-revocation",
          kind: "returned-error",
        })
      } else {
        revocation = "admin"
      }
    } catch {
      reportSafeFailure(dependencies, {
        phase: "admin-revocation",
        kind: "threw",
      })
    }
  }

  try {
    await dependencies.clearBrowserCredentials()
  } catch {
    reportSafeFailure(dependencies, {
      phase: "browser-clear",
      kind: "threw",
    })
    throw new Error(BROWSER_CLEAR_FAILURE_MESSAGE)
  }

  return {
    revocation,
    browserCredentialsCleared: true,
  }
}

function revocationFailed(result: MerchantRecoveryRevocationResult): boolean {
  return Boolean(result && "error" in result && result.error)
}

function reportSafeFailure(
  dependencies: MerchantRecoverySessionCleanupDependencies,
  failure: MerchantRecoveryCleanupFailure
): void {
  try {
    dependencies.onSafeFailure?.(failure)
  } catch {
    // Diagnostics must never interrupt credential cleanup.
  }
}
