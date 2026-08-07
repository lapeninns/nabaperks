import "server-only"

import Stripe from "stripe"

import { getServerEnv } from "@/lib/env/server"

export function getStripe() {
  const env = getServerEnv()

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-07-29.dahlia",
  })
}
