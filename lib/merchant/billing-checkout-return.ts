import "server-only"

import { scheduleMerchantBillingCheckoutReturned } from "@/lib/analytics/merchant-billing-events"
import { autoProvisionJoinQrFromSetup } from "@/lib/merchant/ensure-join-qr"
import { isLaunchBillingReady } from "@/lib/merchant/launch-readiness-core"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import {
  confirmBillingCheckoutReturn,
  createBillingCheckoutDependencies,
  reconcileBillingPortalReturn,
  type BillingReturnOutcome,
} from "@/lib/stripe/checkout"

/** Verify one exact Checkout Session, persist its Subscription, then refresh UI. */
export async function completeBillingCheckoutReturn(
  merchantId: string,
  sessionId: string | null | undefined
): Promise<BillingReturnOutcome> {
  if (!sessionId) return { kind: "missing_session" }

  let outcome: BillingReturnOutcome
  try {
    outcome = await confirmBillingCheckoutReturn(
      { merchantId, sessionId },
      await createBillingCheckoutDependencies(),
      {
        onVerifiedReturn: ({ merchantId: verifiedMerchantId }) => {
          scheduleMerchantBillingCheckoutReturned(verifiedMerchantId)
        },
      }
    )
  } catch {
    outcome = { kind: "catching_up" }
  }

  if (
    outcome.kind === "confirmed" &&
    isLaunchBillingReady({ requiresBilling: true, status: outcome.status })
  ) {
    await autoProvisionJoinQrFromSetup()
    revalidateMerchantLaunchSurfaces(merchantId)
  }

  return outcome
}

/** Reconcile the already-recorded Subscription after Stripe Portal returns. */
export async function completeBillingPortalReturn(
  merchantId: string
): Promise<BillingReturnOutcome> {
  let outcome: BillingReturnOutcome
  try {
    outcome = await reconcileBillingPortalReturn(
      { merchantId },
      await createBillingCheckoutDependencies()
    )
  } catch {
    outcome = { kind: "catching_up" }
  }

  if (
    outcome.kind === "confirmed" &&
    isLaunchBillingReady({ requiresBilling: true, status: outcome.status })
  ) {
    await autoProvisionJoinQrFromSetup()
    revalidateMerchantLaunchSurfaces(merchantId)
  }

  return outcome
}
