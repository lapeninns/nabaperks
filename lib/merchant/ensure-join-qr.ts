import "server-only"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness-core"
import {
  isJoinQrProvisionEligible,
  type EnsureJoinQrInput,
} from "@/lib/merchant/launch-readiness-core"
import { getQrSetupFresh } from "@/lib/merchant/qr-code"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type { EnsureJoinQrInput }
export { isJoinQrProvisionEligible }

export async function ensureJoinQrProvisioned(
  input: EnsureJoinQrInput
): Promise<{ provisioned: boolean; created: boolean }> {
  if (!isJoinQrProvisionEligible(input)) {
    return { provisioned: false, created: false }
  }

  // Eligibility guarantees a non-null card, but TypeScript cannot narrow across
  // the predicate call. Pull it into a local so the RPC below needs no non-null
  // assertion; the guard is unreachable in practice but keeps the type honest.
  const { activeCard } = input
  if (!activeCard) {
    return { provisioned: false, created: false }
  }

  const supabase = await createSupabaseServerClient()

  if (!input.qrCode) {
    const { error } = await supabase.rpc("create_or_get_join_qr", {
      p_merchant_id: input.merchantId,
      p_loyalty_card_id: activeCard.id,
    })

    if (error) {
      logger.error("ensure_join_qr_create_failed", {
        merchantId: input.merchantId,
        rpc: "create_or_get_join_qr",
        error,
      })
      return { provisioned: false, created: false }
    }

    await capturePostHogEvent({
      eventName: "qr_created",
      merchantId: input.merchantId,
      actorType: "merchant",
      actorId: input.merchantId,
      metadata: { source: "reward_pool_auto_provision" },
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
      logger.error("ensure_join_qr_activate_failed", {
        merchantId: input.merchantId,
        qrCodeId: input.qrCode.id,
        rpc: "set_qr_active",
        error,
      })
      return { provisioned: false, created: false }
    }

    return { provisioned: true, created: false }
  }

  return { provisioned: true, created: false }
}

/** Create or re-enable the join QR once venue, card, and reward pool are ready. */
export async function autoProvisionJoinQrFromSetup(): Promise<{
  provisioned: boolean
  created: boolean
}> {
  const setup = await getQrSetupFresh()

  if (!setup.merchant) {
    return { provisioned: false, created: false }
  }

  const readiness = buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
  })

  return ensureJoinQrProvisioned({
    merchantId: setup.merchant.id,
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    venueReady: readiness.tabs.venue,
    qrCode: setup.qrCode,
  })
}
