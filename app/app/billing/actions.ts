"use server"

import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import {
  billingReturnHref,
  resolveBillingReturnBase,
} from "@/lib/merchant/billing-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe/server"

const BILLING_ACTION_ERROR = "Billing action could not be completed. Try again."

export async function startCheckoutAction(
  interval: "month" | "year",
  formData: FormData
) {
  const merchant = await getCurrentMerchant()
  const returnBase = resolveBillingReturnBase(formData.get("returnTo"))

  if (!merchant) {
    redirect("/app/onboarding")
  }

  let env: ReturnType<typeof getServerEnv>
  let billingCustomerId: string | null | undefined

  try {
    env = getServerEnv()

    const supabase = await createSupabaseServerClient()
    const { data: billing, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    billingCustomerId = billing?.stripe_customer_id
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  let checkoutUrl: string

  try {
    const stripe = getStripe()
    const customer =
      billingCustomerId ??
      (
        await stripe.customers.create({
          email: merchant.email,
          name: merchant.business_name,
          metadata: {
            merchant_id: merchant.id,
          },
        })
      ).id

    const priceId =
      interval === "year"
        ? env.STRIPE_GROWTH_ANNUAL_PRICE_ID
        : env.STRIPE_GROWTH_PRICE_ID

    // The annual Price is optional until the operator creates it in Stripe, so
    // guard here — a stray annual submit can never check out an undefined price.
    if (!priceId) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          merchant_id: merchant.id,
          plan: "growth",
          interval,
        },
      },
      metadata: {
        merchant_id: merchant.id,
        plan: "growth",
        interval,
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}${billingReturnHref(returnBase, {
        checkout: "success",
      })}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}${billingReturnHref(returnBase, {
        checkout: "cancelled",
      })}`,
    })

    if (!session.url) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    checkoutUrl = session.url
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  redirect(checkoutUrl)
}

export async function openCustomerPortalAction(formData: FormData) {
  const merchant = await getCurrentMerchant()
  const returnBase = resolveBillingReturnBase(formData.get("returnTo"))

  if (!merchant) {
    redirect("/app/onboarding")
  }

  let env: ReturnType<typeof getServerEnv>
  let billingCustomerId: string | null | undefined

  try {
    env = getServerEnv()

    const supabase = await createSupabaseServerClient()
    const { data: billing, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    billingCustomerId = billing?.stripe_customer_id
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  if (!billingCustomerId) {
    redirect(
      billingReturnHref(returnBase, {
        portal: "missing",
      })
    )
  }

  let portalUrl: string

  try {
    const stripe = getStripe()
    const portal = await stripe.billingPortal.sessions.create({
      customer: billingCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}${returnBase}`,
    })

    if (!portal.url) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    portalUrl = portal.url
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  redirect(portalUrl)
}
