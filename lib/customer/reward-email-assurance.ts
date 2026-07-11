import "server-only"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function hasRewardEmailAssurance(
  rewardId: string
): Promise<boolean> {
  const customer = await getCurrentCustomer()
  if (!customer?.email || !customer.emailVerifiedAt) return false

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_reward_email_assurances")
    .select("reward_event_id")
    .eq("reward_event_id", rewardId)
    .eq("customer_id", customer.id)
    .eq("email_hmac", customerEmailHmac(customer.email))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) throw new Error(`Unable to load email assurance: ${error.message}`)
  return Boolean(data)
}

export async function recordRewardEmailAssurance(
  rewardId: string,
  email: string
): Promise<void> {
  const customer = await getCurrentCustomer()
  if (
    !customer ||
    customer.email?.trim().toLowerCase() !== email.trim().toLowerCase()
  ) {
    throw new Error("Reward email assurance does not match this customer.")
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data: reward, error: rewardError } = await supabase
    .from("reward_events")
    .select("id")
    .eq("id", rewardId)
    .eq("customer_id", customer.id)
    .maybeSingle()

  if (rewardError || !reward) {
    throw new Error("Reward email assurance context was not found.")
  }

  const verifiedAt = new Date()
  const expiresAt = new Date(verifiedAt.getTime() + 30 * 60_000)
  const { error } = await supabase
    .from("customer_reward_email_assurances")
    .upsert({
      reward_event_id: rewardId,
      customer_id: customer.id,
      email_hmac: customerEmailHmac(email),
      verified_at: verifiedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })

  if (error)
    throw new Error(`Unable to record email assurance: ${error.message}`)
}
