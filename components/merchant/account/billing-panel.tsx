import { redirect } from "next/navigation"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import {
  BillingPanelView,
  type BillingPanelOutcome,
} from "@/components/merchant/account/billing-panel-view"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  completeBillingCheckoutReturn,
  completeBillingPortalReturn,
} from "@/lib/merchant/billing-checkout-return"
import { BILLING_LAUNCH_TAB_PATH } from "@/lib/merchant/billing-nav"
import {
  getMerchantBilling,
  getMerchantBillingFresh,
} from "@/lib/merchant/billing"

export type BillingPanelParams = {
  checkout?: string
  portal?: string
  session_id?: string
  billing_error?: string
}

/**
 * Authenticated billing orchestration. Provider/database state is resolved here;
 * the shared view receives only a read model and a truthful typed outcome.
 */
export async function BillingPanel({
  params,
  mode = "account",
  initialOutcome,
}: {
  params: BillingPanelParams
  mode?: "account" | "setup"
  initialOutcome?: BillingPanelOutcome
}) {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/app/onboarding")

  let outcome = initialOutcome ?? resolveStaticOutcome(params)
  let reconciled = initialOutcome !== undefined

  if (initialOutcome === undefined && params.checkout === "success") {
    outcome = await completeBillingCheckoutReturn(
      merchant.id,
      params.session_id
    )
    reconciled = true
  } else if (initialOutcome === undefined && params.portal === "returned") {
    outcome = await completeBillingPortalReturn(merchant.id)
    reconciled = true
  }

  const result = reconciled
    ? await getMerchantBillingFresh(merchant.id)
    : await getMerchantBilling(merchant.id)
  const billingReturnTo = mode === "setup" ? BILLING_LAUNCH_TAB_PATH : undefined

  return (
    <BillingPanelView
      billing={result.ok ? result.billing : null}
      outcome={outcome}
      mode={mode}
      annualBillingAvailable={Boolean(
        process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID
      )}
      checkoutAction={startCheckoutAction}
      portalAction={openCustomerPortalAction}
      billingReturnTo={billingReturnTo}
      billingLoadFailed={!result.ok}
      refreshHref={
        mode === "setup" ? BILLING_LAUNCH_TAB_PATH : "/app/account?tab=billing"
      }
    />
  )
}

function resolveStaticOutcome(params: BillingPanelParams): BillingPanelOutcome {
  if (params.checkout === "cancelled") {
    return { kind: "checkout_cancelled" }
  }
  if (params.portal === "missing") {
    return { kind: "portal_missing" }
  }
  if (params.billing_error) {
    return { kind: "action_error" }
  }
  return null
}
