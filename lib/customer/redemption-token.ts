import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type RedemptionToken = {
  readonly tokenId: string
  readonly publicToken: string
  readonly expiresAt: string
}

export type RedemptionTokenStatus = {
  readonly status: "pending" | "consumed" | "expired" | "none"
  readonly consumedAt: string | null
  readonly rewardName: string | null
}

export async function createRedemptionToken(
  rewardId: string
): Promise<RedemptionToken> {
  const customer = await getCurrentCustomer()
  if (!customer) {
    throw new Error("Open your cards first.")
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_redemption_token", {
    p_reward_event_id: rewardId,
    p_customer_id: customer.id,
  })

  if (error) {
    throw new Error(`Unable to create redemption QR: ${error.message}`)
  }

  const row = firstRecord(data)
  const tokenId = stringValue(row?.token_id)
  const publicToken = stringValue(row?.public_token)
  const expiresAt = stringValue(row?.expires_at)

  if (!tokenId || !publicToken || !expiresAt) {
    throw new Error("Unable to create redemption QR")
  }

  return { tokenId, publicToken, expiresAt }
}

export async function getRedemptionTokenStatus(
  rewardId: string
): Promise<RedemptionTokenStatus> {
  const customer = await getCurrentCustomer()
  if (!customer) {
    return { status: "none", consumedAt: null, rewardName: null }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_redemption_token_status", {
    p_reward_event_id: rewardId,
    p_customer_id: customer.id,
  })

  if (error) {
    throw new Error(`Unable to load redemption QR status: ${error.message}`)
  }

  const row = firstRecord(data)
  const status = redemptionStatus(row?.status)

  return {
    status,
    consumedAt: stringValue(row?.consumed_at),
    rewardName: stringValue(row?.reward_name),
  }
}

function redemptionStatus(value: unknown): RedemptionTokenStatus["status"] {
  switch (value) {
    case "pending":
    case "consumed":
    case "expired":
    case "none":
      return value
    default:
      return "none"
  }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null

  const [first] = value
  if (!isRecord(first)) return null

  return first
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
