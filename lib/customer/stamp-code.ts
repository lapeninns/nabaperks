import "server-only"

import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type CreateCodeResult =
  | { status: "created"; tokenId: string; code: string; expiresAt: string }
  | { status: "blocked"; reason: string }

export type TokenStatus = {
  status: "pending" | "approved" | "expired" | "cancelled"
  kind: "stamp" | "redeem"
  expiresAt: string
  newStampCount: number | null
  rewardUnlocked: boolean
  rewardId: string | null
}

type TokenRow = {
  token_id: string
  code: string
  expires_at: string
}

type StatusRow = {
  status: TokenStatus["status"]
  kind: TokenStatus["kind"]
  expires_at: string
  new_stamp_count: number | null
  reward_unlocked: boolean | null
  reward_event_id: string | null
}

export async function createStampCode(
  membershipId: string
): Promise<CreateCodeResult> {
  return createCode({
    p_membership_id: membershipId,
    p_kind: "stamp",
  })
}

export async function createRedeemCode(
  membershipId: string,
  rewardId: string
): Promise<CreateCodeResult> {
  return createCode({
    p_membership_id: membershipId,
    p_kind: "redeem",
    p_reward_event_id: rewardId,
  })
}

async function createCode(params: {
  p_membership_id: string
  p_kind: "stamp" | "redeem"
  p_reward_event_id?: string
}): Promise<CreateCodeResult> {
  try {
    await enforceRateLimit({
      key: `verification-code:${params.p_membership_id}:${params.p_kind}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        status: "blocked",
        reason: "Too many codes requested. Give it a minute and try again.",
      }
    }

    throw error
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "create_verification_token",
    params
  )

  if (error) {
    const reason = blockedReason(error.message)

    if (reason) return { status: "blocked", reason }

    throw new Error(`Unable to create a verification code: ${error.message}`)
  }

  const row = first<TokenRow>(data)

  if (!row) {
    throw new Error("Unable to create a verification code")
  }

  return {
    status: "created",
    tokenId: row.token_id,
    code: row.code,
    expiresAt: row.expires_at,
  }
}

export async function getTokenStatus(
  tokenId: string
): Promise<TokenStatus | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_verification_token_status", {
    p_token_id: tokenId,
  })

  if (error) {
    if (/not found|ownership|Authentication required/i.test(error.message)) {
      return null
    }

    throw new Error(`Unable to check the code status: ${error.message}`)
  }

  const row = first<StatusRow>(data)

  if (!row) return null

  return {
    status: row.status,
    kind: row.kind,
    expiresAt: row.expires_at,
    newStampCount: row.new_stamp_count,
    rewardUnlocked: Boolean(row.reward_unlocked),
    rewardId: row.reward_event_id,
  }
}

function blockedReason(message: string) {
  if (message.includes("Stamp already issued for this UK business day")) {
    return "You're already stamped today. Come back tomorrow."
  }

  if (message.includes("A reward is already ready to redeem")) {
    return "Your reward is ready — redeem it before collecting more stamps."
  }

  if (message.includes("Reward already redeemed")) {
    return "This reward has already been redeemed."
  }

  if (message.includes("not redeemable until the next UK business day")) {
    return "Give it a day to breathe — redeemable from the next UK business day."
  }

  if (message.includes("Reward is not redeemable")) {
    return "This reward is not redeemable."
  }

  if (message.includes("not active") || message.includes("unavailable")) {
    return "This loyalty programme is unavailable right now."
  }

  return null
}

function first<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null

  return (data as T) ?? null
}
