import "server-only"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const MIN_ACTIVE_REWARDS = 3

export type EnsureJoinQrInput = {
  merchantId: string
  activeCard: { id: string } | null
  activeRewardPoolItemCount: number
  venueReady: boolean
  billingReady: boolean
  qrCode: { id: string; is_active: boolean } | null
}

export async function ensureJoinQrProvisioned(
  input: EnsureJoinQrInput
): Promise<{ provisioned: boolean; created: boolean }> {
  if (
    !input.activeCard ||
    input.activeRewardPoolItemCount < MIN_ACTIVE_REWARDS ||
    !input.venueReady ||
    !input.billingReady
  ) {
    return { provisioned: false, created: false }
  }

  const supabase = await createSupabaseServerClient()

  if (!input.qrCode) {
    const { error } = await supabase.rpc("create_or_get_join_qr", {
      p_merchant_id: input.merchantId,
      p_loyalty_card_id: input.activeCard.id,
    })

    if (error) {
      return { provisioned: false, created: false }
    }

    await capturePostHogEvent({
      eventName: "qr_created",
      merchantId: input.merchantId,
      actorType: "merchant",
      actorId: input.merchantId,
      metadata: { source: "auto_launch_provision" },
    })

    return { provisioned: true, created: true }
  }

  if (!input.qrCode.is_active) {
    const { error } = await supabase.rpc("set_qr_active", {
      p_merchant_id: input.merchantId,
      p_qr_code_id: input.qrCode.id,
      p_is_active: true,
    })

    if (error) {
      return { provisioned: false, created: false }
    }

    return { provisioned: true, created: false }
  }

  return { provisioned: true, created: false }
}
