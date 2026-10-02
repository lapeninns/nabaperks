import "server-only"

import {
  authHookSmsChallengeDigest,
  parseAuthHookClaim,
  smsHookChallengeWindowSeconds,
  type AuthHookClaim,
} from "@/lib/auth/auth-hook-delivery-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function claimSmsAuthHookDelivery(
  secret: string,
  phone: string,
  code: string
): Promise<AuthHookClaim & { readonly deliveryId: string }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("claim_auth_hook_sms_delivery", {
    p_challenge_digest: authHookSmsChallengeDigest(secret, phone, code),
    p_window_seconds: smsHookChallengeWindowSeconds(
      process.env.SUPABASE_SMS_OTP_EXPIRY_SECONDS
    ),
  })
  const claim = parseAuthHookClaim(data)
  if (
    error ||
    !claim ||
    typeof data?.delivery_id !== "string" ||
    !/^sms-otp:[0-9a-f]{64}:[0-9a-f-]{36}$/.test(data.delivery_id)
  ) {
    throw new Error("Unable to claim SMS challenge delivery.")
  }
  return { ...claim, deliveryId: data.delivery_id }
}
