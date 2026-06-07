"use server"

import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe/server"

const BILLING_ACTION_ERROR = "Billing action could not be completed. Try again."

export async function startCheckoutAction() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const env = getServerEnv()
  const stripe = getStripe()
  const supabase = createSupabaseServiceRoleClient()
  const { data: billing, error } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("merchant_id", merchant.id)
    .maybeSingle()

  if (error) {
    throw new Error(BILLING_ACTION_ERROR)
  }

  const customer =
    billing?.stripe_customer_id ??
    (
      await stripe.customers.create({
        email: merchant.email,
        name: merchant.business_name,
        metadata: {
          merchant_id: merchant.id,
        },
      })
    ).id

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [
      {
        price: env.STRIPE_GROWTH_PRICE_ID,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        merchant_id: merchant.id,
        plan: "growth",
      },
    },
    metadata: {
      merchant_id: merchant.id,
      plan: "growth",
    },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=cancelled`,
  })

  if (!session.url) {
    throw new Error(BILLING_ACTION_ERROR)
  }

  redirect(session.url)
}

export async function openCustomerPortalAction() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const env = getServerEnv()
  const supabase = createSupabaseServiceRoleClient()
  const { data: billing, error } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("merchant_id", merchant.id)
    .maybeSingle()

  if (error) {
    throw new Error(BILLING_ACTION_ERROR)
  }

  if (!billing?.stripe_customer_id) {
    redirect("/app/billing?portal=missing")
  }

  const stripe = getStripe()
  const portal = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing`,
  })

  redirect(portal.url)
}
