"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import type { BillingCheckoutActionState } from "@/components/merchant/account/billing-checkout-form"
import { observeMerchantBillingCheckoutPreparation } from "@/lib/analytics/merchant-billing-events"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { resolveBillingAppOrigin } from "@/lib/merchant/billing-checkout-core"
import {
  billingReturnHref,
  resolveBillingReturnBase,
} from "@/lib/merchant/billing-nav"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import {
  createBillingCheckoutDependencies,
  prepareBillingCheckout,
  type BillingInterval,
} from "@/lib/stripe/checkout"
import { getStripe } from "@/lib/stripe/server"

const BILLING_ACTION_ERROR =
  "Billing was not confirmed. Please try again — it is safe to retry."
const COMPLIMENTARY_ACCESS_MESSAGE =
  "This venue has complimentary access. No Stripe checkout is needed."

function submittedInterval(
  value: FormDataEntryValue | null
): BillingInterval | null {
  return value === "month" || value === "year" ? value : null
}

async function requestOrigin(): Promise<string | null> {
  const requestHeaders = await headers()
  return requestHeaders.get("origin")
}

/** Start one fenced, provider-idempotent Checkout attempt. */
export async function startCheckoutAction(
  _previousState: BillingCheckoutActionState,
  formData: FormData
): Promise<BillingCheckoutActionState> {
  const merchant = await getCurrentMerchant()
  const returnBase = resolveBillingReturnBase(formData.get("returnTo"))
  const interval = submittedInterval(formData.get("interval"))

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!interval) {
    return { status: "error", message: BILLING_ACTION_ERROR }
  }

  if (merchant.requires_billing === false) {
    return { status: "error", message: COMPLIMENTARY_ACCESS_MESSAGE }
  }

  let checkoutUrl: string | null = null
  try {
    const env = getServerEnv()
    const deps = await createBillingCheckoutDependencies()
    const result = await observeMerchantBillingCheckoutPreparation(
      merchant.id,
      async () =>
        prepareBillingCheckout(
          {
            merchant: {
              id: merchant.id,
            },
            interval,
            returnBase,
            environment:
              process.env.NODE_ENV === "production"
                ? "production"
                : "development",
            configuredOrigin: env.NEXT_PUBLIC_APP_URL,
            requestOrigin: await requestOrigin(),
            monthlyPriceId: env.STRIPE_GROWTH_PRICE_ID,
            annualPriceId: env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
          },
          deps
        )
    )

    if (result.status === "error") {
      return result
    }
    checkoutUrl = result.url
  } catch (error) {
    console.error("[billing] checkout start failed", {
      merchantId: merchant.id,
      code: "checkout_start_failed",
      error: error instanceof Error ? error.name : "unknown",
    })
    return { status: "error", message: BILLING_ACTION_ERROR }
  }

  redirect(checkoutUrl)
}

/** Open the known customer's Stripe Portal with a one-shot return outcome. */
export async function openCustomerPortalAction(formData: FormData) {
  const merchant = await getCurrentMerchant()
  const returnBase = resolveBillingReturnBase(formData.get("returnTo"))

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (merchant.requires_billing === false) {
    redirect(returnBase)
  }

  const failureHref = billingReturnHref(returnBase, {
    billing_error: "action",
  })
  let portalUrl: string | null = null
  let missingCustomer = false

  try {
    const env = getServerEnv()
    const supabase = createSupabaseServiceRoleClient()
    const { data: billing, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) throw new Error("billing_customer_lookup_failed")
    missingCustomer = !billing?.stripe_customer_id

    if (billing?.stripe_customer_id) {
      const origin = resolveBillingAppOrigin({
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
        configuredOrigin: env.NEXT_PUBLIC_APP_URL,
        requestOrigin: await requestOrigin(),
      })
      const portal = await getStripe().billingPortal.sessions.create({
        customer: billing.stripe_customer_id,
        return_url: `${origin}${billingReturnHref(returnBase, {
          portal: "returned",
        })}`,
      })

      if (!portal.url) throw new Error("portal_url_missing")
      portalUrl = portal.url
    }
  } catch (error) {
    console.error("[billing] portal start failed", {
      merchantId: merchant.id,
      code: "portal_start_failed",
      error: error instanceof Error ? error.name : "unknown",
    })
    redirect(failureHref)
  }

  if (missingCustomer) {
    redirect(billingReturnHref(returnBase, { portal: "missing" }))
  }

  if (!portalUrl) {
    redirect(failureHref)
  }

  redirect(portalUrl)
}
