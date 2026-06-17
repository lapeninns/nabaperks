import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type RewardScanToken = {
  scanToken: string
  expiresAt: string
}

export async function createRewardScanToken({
  rewardId,
  customerId,
}: {
  rewardId: string
  customerId: string
}): Promise<RewardScanToken> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_reward_scan_token", {
    p_reward_event_id: rewardId,
    p_customer_id: customerId,
  })

  if (error) {
    throw new Error(`Unable to create reward scan token: ${error.message}`)
  }

  const result = firstRecord(data)
  const scanToken = stringField(result, "scan_token")
  const expiresAt = stringField(result, "expires_at")

  if (!scanToken || !expiresAt) {
    throw new Error("Unable to create reward scan token.")
  }

  return { scanToken, expiresAt }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const [first] = value
    return isRecord(first) ? first : null
  }

  return isRecord(value) ? value : null
}

function stringField(
  record: Record<string, unknown> | null,
  key: string
): string | null {
  const value = record?.[key]
  return typeof value === "string" && value.trim() ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
