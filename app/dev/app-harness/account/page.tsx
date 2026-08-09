import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { AccountTabBar } from "@/components/merchant/account/account-tab-bar"
import {
  firstAccountSearchParamValue,
  resolveAccountTab,
  type AccountSearchParams,
} from "@/components/merchant/account/account-tabs"
import type { BillingPanelOutcome } from "@/components/merchant/account/billing-panel-view"
import { ProfilePanelView } from "@/components/merchant/account/profile-panel-view"
import { classifyCheckoutReturnSession } from "@/lib/merchant/billing-checkout-core"
import type { BillingPresentationSource } from "@/lib/merchant/billing-presentation"

import { HARNESS_MERCHANT } from "../fixtures"
import { BillingHarnessClient } from "./billing-harness-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TAB_HEADING = {
  profile: {
    title: "Profile",
    description: "Your venue details. Save when you're done.",
  },
  billing: {
    title: "Billing",
    description: "Your venue access and payment status.",
  },
} as const

type AccountHarnessPageProps = {
  searchParams?: Promise<AccountSearchParams>
}

/**
 * Account harness — mounts the REAL {@link AccountTabBar} (the segmented sub-nav
 * the /app/account page renders) and, for the Profile tab, the REAL
 * {@link MerchantProfileForm} client body fed DB-free props plus a reconstructed
 * "What customers see" snapshot mirroring ProfilePanel's read-only card.
 *
 * The Billing tab mounts the production {@link BillingPanelView} through a
 * client harness that injects provider-shaped fixtures at its external action
 * boundary. Checkout-return fixtures still pass through the real exact-Session
 * classifier before any success or rejection outcome is rendered.
 */
export default async function AccountHarnessPage({
  searchParams,
}: AccountHarnessPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const tab = resolveAccountTab(params.tab)
  const heading = TAB_HEADING[tab]
  const billingState = firstAccountSearchParamValue(params.billing) ?? "none"
  const billing = resolveHarnessBilling(billingState)
  const outcome = resolveHarnessBillingOutcome(params, billing)
  const checkoutActionMode =
    firstAccountSearchParamValue(params.checkout_action) === "fail"
      ? "fail"
      : "safe"
  const requiresBilling =
    firstAccountSearchParamValue(params.access) !== "complimentary"
  const refreshHref =
    "/dev/app-harness/account?tab=billing&billing=" +
    encodeURIComponent(billingState)

  return (
    <div className="grid gap-6">
      <PageTitle title={heading.title} description={heading.description} />
      <AccountTabBar activeTab={tab} />

      {tab === "billing" ? (
        <BillingHarnessClient
          billing={billing}
          outcome={outcome}
          checkoutActionMode={checkoutActionMode}
          refreshHref={refreshHref}
          requiresBilling={requiresBilling}
        />
      ) : (
        <ProfilePanelView
          businessName={HARNESS_MERCHANT.business_name}
          businessType="pub"
          email="owner@oldcrowngirton.co.uk"
          phone="07700900421"
          venueAddressDisplay="12 High Street, Girton, Cambridge, CB3 0QH"
        />
      )}
    </div>
  )
}

const BASE_BILLING: BillingPresentationSource = {
  status: "active",
  stripe_subscription_status: "active",
  stripe_customer_id: "cus_harness_owned",
  billing_interval: "day",
  unit_amount: 6_999,
  currency: "gbp",
  current_period_end: "2026-08-09T12:00:00.000Z",
  cancel_at_period_end: false,
  cancel_at: null,
  launch_fee_status: "grandfathered",
}

function resolveHarnessBilling(
  state: string
): BillingPresentationSource | null {
  if (state === "trialing") {
    return {
      ...BASE_BILLING,
      status: "trialing",
      stripe_subscription_status: "trialing",
    }
  }

  if (state === "active-year") {
    return {
      ...BASE_BILLING,
      billing_interval: "year",
      unit_amount: 69_990,
      current_period_end: "2027-07-10T12:00:00.000Z",
    }
  }

  if (state === "cancelled") {
    return {
      ...BASE_BILLING,
      status: "cancelled",
      stripe_subscription_status: "canceled",
    }
  }

  if (state === "scheduled-cancellation") {
    return {
      ...BASE_BILLING,
      cancel_at_period_end: true,
      cancel_at: "2026-08-09T12:00:00.000Z",
    }
  }

  return null
}

function resolveHarnessBillingOutcome(
  params: AccountSearchParams,
  billing: BillingPresentationSource | null
): BillingPanelOutcome {
  const checkout = firstAccountSearchParamValue(params.checkout)
  const portal = firstAccountSearchParamValue(params.portal)

  if (checkout === "success") {
    const requestedSessionId = firstAccountSearchParamValue(params.session_id)
    const owned = requestedSessionId === "cs_harness_owned"
    const classification = classifyCheckoutReturnSession({
      requestedSessionId,
      recordedSessionId: "cs_harness_owned",
      expectedMerchantId: "merchant_harness",
      expectedCustomerId: "cus_harness_owned",
      session: requestedSessionId
        ? {
            id: requestedSessionId,
            mode: "subscription",
            status: "complete",
            payment_status: "no_payment_required",
            customer: owned ? "cus_harness_owned" : "cus_harness_foreign",
            subscription: owned ? "sub_harness_owned" : "sub_harness_foreign",
            metadata: {
              merchant_id: owned ? "merchant_harness" : "merchant_foreign",
            },
          }
        : null,
    })

    if (classification.kind === "missing") {
      return { kind: "missing_session" }
    }

    if (classification.kind === "rejected") {
      return { kind: "rejected", reason: classification.reason }
    }

    return billing
      ? {
          kind: "confirmed",
          source: "checkout",
          status: billing.status ?? "trialing",
        }
      : { kind: "catching_up" }
  }

  if (checkout === "cancelled") {
    return { kind: "checkout_cancelled" }
  }

  if (portal === "returned") {
    return billing
      ? {
          kind: "confirmed",
          source: "portal",
          status: billing.status ?? "active",
        }
      : { kind: "catching_up" }
  }

  if (portal === "missing") {
    return { kind: "portal_missing" }
  }

  if (firstAccountSearchParamValue(params.billing_error)) {
    return { kind: "action_error" }
  }

  return null
}
