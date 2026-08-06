import "server-only"

import { capturePostHogEvent } from "@/lib/analytics/events"
import {
  REFERRAL_HEALTH_EVENT_NAMES,
  buildReferralHealthMirrorEvent,
  type ReferralHealthRow,
} from "@/lib/analytics/referral-health-core"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Forward recently recorded referral-health rows to PostHog.
 *
 * Runs from the referral bonus drain cron, which is already the sweep that owns
 * referral state. The window overlaps deliberately: PostHog de-duplicates on
 * `$insert_id` (derived from the product_events row id), so re-sending is free
 * and a missed tick self-heals without a "mirrored" flag to keep in step.
 *
 * Never throws. Analytics is a mirror of the ledger; the ledger row is already
 * committed and is the thing that matters.
 */
export async function mirrorReferralHealthEvents(
  windowMinutes = 30
): Promise<number> {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const since = new Date(
      Date.now() - Math.max(windowMinutes, 1) * 60_000
    ).toISOString()

    const { data, error } = await supabase
      .from("product_events")
      .select(
        "id, event_name, merchant_id, customer_id, membership_id, metadata"
      )
      .in("event_name", [...REFERRAL_HEALTH_EVENT_NAMES])
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(500)

    if (error) {
      logger.warn("referral_health_mirror_read_failed", {
        reason: error.message,
      })
      return 0
    }

    const rows = Array.isArray(data) ? (data as ReferralHealthRow[]) : []
    let mirrored = 0

    for (const row of rows) {
      const event = buildReferralHealthMirrorEvent(row)
      if (!event) continue
      await capturePostHogEvent(event)
      mirrored += 1
    }

    return mirrored
  } catch (cause) {
    logger.warn("referral_health_mirror_failed", {
      reason: cause instanceof Error ? cause.message : "unknown",
    })
    return 0
  }
}
