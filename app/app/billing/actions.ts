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
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"
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

export type CancellationInterviewActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "follow_up_requested" }

function submittedInterval(
  value: FormDataEntryValue | null
): BillingInterval | null {
  if (value === "day") return "month"
  if (value === "year") return "year"
  return null
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
            launchPriceId: env.STRIPE_LAUNCH_PRICE_ID,
            recurringPriceId: env.STRIPE_GROWTH_PRICE_ID,
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

  const failureHref = billingReturnHref(returnBase, {
    billing_error: "action",
  })
  let portalUrl: string | null = null
  let missingCustomer = false

  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data: billing, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) throw new Error("billing_customer_lookup_failed")
    missingCustomer = !billing?.stripe_customer_id

    if (billing?.stripe_customer_id) {
      const env = getServerEnv()
      const origin = resolveBillingAppOrigin({
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
        configuredOrigin: env.NEXT_PUBLIC_APP_URL,
        requestOrigin: await requestOrigin(),
      })
      const returnUrl = `${origin}${billingReturnHref(returnBase, {
        portal: "returned",
      })}`
      const portal = await getStripe().billingPortal.sessions.create({
        customer: billing.stripe_customer_id,
        return_url: returnUrl,
        flow_data: {
          type: "payment_method_update",
          after_completion: {
            type: "redirect",
            redirect: { return_url: returnUrl },
          },
        },
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
    if (merchant.requires_billing === false) {
      redirect(returnBase)
    }
    redirect(billingReturnHref(returnBase, { portal: "missing" }))
  }

  if (!portalUrl) {
    redirect(failureHref)
  }

  redirect(portalUrl)
}

/** Record the exit interview before opening Stripe's direct cancel flow. */
export async function submitCancellationInterviewAction(
  _previousState: CancellationInterviewActionState,
  formData: FormData
): Promise<CancellationInterviewActionState> {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/app/onboarding")

  const primaryReason = formData.get("primaryReason")
  const details = formData.get("details")
  const requestedResolution = formData.get("requestedResolution")

  if (
    typeof primaryReason !== "string" ||
    typeof details !== "string" ||
    (requestedResolution !== "continue_cancellation" &&
      requestedResolution !== "support_call")
  ) {
    return {
      status: "error",
      message:
        "Choose a cancellation reason and what you would like to do next.",
    }
  }

  let cancellationPortalUrl: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const [{ data, error }, billingResult] = await Promise.all([
      supabase.rpc("record_merchant_cancellation_interview", {
        p_merchant_id: merchant.id,
        p_primary_reason: primaryReason,
        p_details: details,
        p_requested_resolution: requestedResolution,
      }),
      supabase
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("merchant_id", merchant.id)
        .maybeSingle(),
    ])

    const row = Array.isArray(data) ? data[0] : null
    if (
      error ||
      billingResult.error ||
      !row ||
      typeof row.stripe_subscription_id !== "string"
    ) {
      return {
        status: "error",
        message: "The exit review could not be saved. Please try again.",
      }
    }

    if (!row.should_open_portal) {
      return { status: "follow_up_requested" }
    }

    if (!billingResult.data?.stripe_customer_id) {
      return {
        status: "error",
        message: "Stripe billing is still syncing. Please try again shortly.",
      }
    }

    const env = getServerEnv()
    const origin = resolveBillingAppOrigin({
      environment:
        process.env.NODE_ENV === "production" ? "production" : "development",
      configuredOrigin: env.NEXT_PUBLIC_APP_URL,
      requestOrigin: await requestOrigin(),
    })
    const returnUrl = `${origin}/app/account?tab=billing&portal=returned`
    const portal = await getStripe().billingPortal.sessions.create({
      customer: billingResult.data.stripe_customer_id,
      return_url: returnUrl,
      flow_data: {
        type: "subscription_cancel",
        subscription_cancel: { subscription: row.stripe_subscription_id },
        after_completion: {
          type: "redirect",
          redirect: { return_url: returnUrl },
        },
      },
    })

    if (!portal.url) {
      return {
        status: "error",
        message: "Stripe cancellation could not be opened. Please try again.",
      }
    }

    cancellationPortalUrl = portal.url
  } catch (error) {
    console.error("[billing] cancellation interview failed", {
      merchantId: merchant.id,
      code: "cancellation_interview_failed",
      error: error instanceof Error ? error.name : "unknown",
    })
    return {
      status: "error",
      message: "The exit review could not be completed. Please try again.",
    }
  }

  if (!cancellationPortalUrl) {
    return {
      status: "error",
      message: "Stripe cancellation could not be opened. Please try again.",
    }
  }

  redirect(cancellationPortalUrl)
}
