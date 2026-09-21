import "server-only"

import {
  getLaunchBillingReadiness,
  getMerchantLaunchReadiness,
} from "@/lib/merchant/launch-readiness"
import { countRows } from "@/lib/merchant/dashboard-counts"
import type { MoreRowsInput } from "@/lib/merchant/more-model"
import { getLiveOfferCampaignName } from "@/lib/merchant/offer-campaigns"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * The More screen's live subtitles, each read settling on its own: a failed
 * read yields null and the row renders without a subtitle. Every value
 * traces to an existing counter or durable ledger: the latest qr_downloaded
 * event (print kit downloaded), customer_memberships (members), the live
 * campaign row (offers, throwing on failure), the notification ledger's
 * latest queued venue announcement (announce), launch readiness (setup) and
 * the billing readiness read (account), where a required but missing billing
 * row is "not started" and a venue that needs no billing says so.
 */
export async function loadMoreRowsInput(merchant: {
  readonly id: string
  readonly requires_billing: boolean | null
}): Promise<MoreRowsInput> {
  const [printed, members, offer, announced, readiness, billing] =
    await Promise.allSettled([
      latestProductEventAt(merchant.id, "qr_downloaded"),
      countRows("customer_memberships", merchant.id),
      getLiveOfferCampaignName(merchant.id),
      latestQueuedAnnouncementAt(merchant.id),
      getMerchantLaunchReadiness(),
      getLaunchBillingReadiness(
        merchant.id,
        merchant.requires_billing !== false
      ),
    ])

  return {
    printKitDownloaded:
      printed.status === "fulfilled" ? printed.value !== null : null,
    memberCount: members.status === "fulfilled" ? members.value : null,
    activeOfferName: offer.status === "fulfilled" ? (offer.value ?? "") : null,
    lastAnnouncementAt:
      announced.status === "fulfilled" ? (announced.value ?? "") : null,
    setup:
      readiness.status === "fulfilled"
        ? {
            completed: readiness.value.completed,
            total: readiness.value.total,
            launchReady: readiness.value.launchReady,
          }
        : null,
    billingStatus:
      billing.status === "fulfilled"
        ? billing.value.requiresBilling
          ? (billing.value.status ?? "not_started")
          : "not_required"
        : null,
    trialDaysLeft: null,
  }
}

async function latestProductEventAt(
  merchantId: string,
  eventName: string
): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("product_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("event_name", eventName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to read ${eventName}: ${error.message}`)
  }

  return typeof data?.created_at === "string" ? data.created_at : null
}

/** The durable ledger: a venue_announcement row that was actually queued. */
async function latestQueuedAnnouncementAt(
  merchantId: string
): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("notification_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("event_type", "venue_announcement")
    .in("status", ["queued", "delivering", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to read announcements: ${error.message}`)
  }

  return typeof data?.created_at === "string" ? data.created_at : null
}
