import "server-only"

import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { countRows, getBillingStatus } from "@/lib/merchant/dashboard-counts"
import type { MoreRowsInput } from "@/lib/merchant/more-model"
import { getActiveOfferCampaign } from "@/lib/merchant/offer-campaigns"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * The More screen's live subtitles, each read settling on its own: a failed
 * read yields null and the row renders without a subtitle. Every value
 * traces to an existing counter or event: the latest qr_downloaded event
 * (printed), customer_memberships (members), the live campaign row
 * (offers), the latest push_venue_announcement_queued event (announce),
 * launch readiness (setup) and billing_customers (account).
 */
export async function loadMoreRowsInput(merchant: {
  readonly id: string
  readonly status: string
}): Promise<MoreRowsInput> {
  const [printed, members, offer, announced, readiness, billing] =
    await Promise.allSettled([
      latestEventAt(merchant.id, "qr_downloaded"),
      countRows("customer_memberships", merchant.id),
      getActiveOfferCampaign(merchant.id),
      latestEventAt(merchant.id, "push_venue_announcement_queued"),
      getMerchantLaunchReadiness(),
      getBillingStatus(merchant.id, merchant.status),
    ])

  return {
    posterPrinted:
      printed.status === "fulfilled" ? printed.value !== null : null,
    memberCount: members.status === "fulfilled" ? members.value : null,
    activeOfferName:
      offer.status === "fulfilled"
        ? offer.value?.status === "live"
          ? (offer.value.name ?? "Live offer")
          : ""
        : null,
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
    billingStatus: billing.status === "fulfilled" ? billing.value : null,
    trialDaysLeft: null,
  }
}

async function latestEventAt(
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
