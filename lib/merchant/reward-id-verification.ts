import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import {
  merchantCollectionBlockedCopy,
  type MerchantScannedRewardCollectionResult,
} from "./reward-collection"

type VerifiedCollectionRow = {
  reward_event_id: string
  reward_name: string
  membership_id: string
}

export async function verifyAndCollectMerchantReward({
  scanToken,
  expectedDateOfBirth,
  idConfirmed,
}: {
  scanToken: string
  expectedDateOfBirth: string
  idConfirmed: boolean
}): Promise<MerchantScannedRewardCollectionResult> {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    return {
      status: "blocked",
      reason:
        "Log in to your merchant account to check ID and collect this reward.",
    }
  }
  if (!idConfirmed) {
    return {
      status: "blocked",
      reason: "Confirm the in-person photo ID check before collection.",
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDateOfBirth)) {
    return {
      status: "blocked",
      reason: "Refresh this reward and check the date of birth again.",
    }
  }

  // The database derives owner authority from this session, never the form.
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "verify_and_collect_reward_scan_token",
    {
      p_scan_token: scanToken,
      p_expected_date_of_birth: expectedDateOfBirth,
      p_id_confirmed: idConfirmed,
    }
  )
  if (error) {
    return {
      status: "blocked",
      reason: merchantCollectionBlockedCopy(error.message),
    }
  }

  const row: unknown = Array.isArray(data) ? data[0] : data
  if (!isVerifiedCollectionRow(row)) {
    return {
      status: "blocked",
      reason: "Reward could not be collected. Refresh to check its status.",
    }
  }
  return {
    status: "collected",
    scanToken,
    rewardId: row.reward_event_id,
    membershipId: row.membership_id,
    merchantId: merchant.id,
    rewardName: row.reward_name,
  }
}

function isVerifiedCollectionRow(
  value: unknown
): value is VerifiedCollectionRow {
  if (!value || typeof value !== "object") return false
  return ["reward_event_id", "reward_name", "membership_id"].every((key) => {
    const field: unknown = Reflect.get(value, key)
    return typeof field === "string" && field.trim().length > 0
  })
}
