import type { Page } from "@playwright/test"

import { merchantAuthRecoveryLiveDbSkipReason } from "./merchant-auth-recovery-live-db"

export function authPasswordPolicyLiveDbSkipReason(): string | undefined {
  return merchantAuthRecoveryLiveDbSkipReason()
}

export async function assertPublicLocalPasswordPolicy(
  _page: Page
): Promise<void> {
  void _page
  throw new Error("Public local password-policy proof is not implemented yet.")
}
