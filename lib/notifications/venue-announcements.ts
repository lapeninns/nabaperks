import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import { enqueueNotificationEvent } from "@/lib/notifications/events"
import { londonBusinessDate } from "@/lib/notifications/london-time"
import {
  normalizeVenueAnnouncementMemberships,
  resolveVenueAnnouncementAudienceCustomerIds,
  validateVenueAnnouncementText,
  VENUE_ANNOUNCEMENT_DAILY_LIMIT,
  VENUE_ANNOUNCEMENT_DAILY_WINDOW_MS,
  venueAnnouncementDailyLimitKey,
  venueAnnouncementDedupeKey,
  type VenueAnnouncementMembership,
} from "@/lib/notifications/venue-announcement-core"
import { logger } from "@/lib/observability/logger"
import { peekRateLimit } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export { validateVenueAnnouncementText } from "@/lib/notifications/venue-announcement-core"

export type VenueAnnouncementInput = {
  merchantId: string
  businessName: string
  title: string
  body: string
  actorId?: string | null
  limit?: number
}

export type VenueAnnouncementResult = {
  eligible: number
  queued: number
  skipped: number
}

export type VenueAnnouncementAudienceSummary = {
  readonly members: number
  readonly eligible: number
}

export type VenueAnnouncementDailyUsage = {
  readonly used: number
  readonly limit: number
}

export async function getVenueAnnouncementAudienceSummary(
  merchantId: string
): Promise<VenueAnnouncementAudienceSummary> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select("id, customer_id")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(`Unable to load announcement audience: ${error.message}`)
  }

  const memberships = normalizeVenueAnnouncementMemberships(data)
  if (memberships.length === 0) {
    return { members: 0, eligible: 0 }
  }

  const audience = await resolveAnnouncementAudience(memberships, merchantId)

  return { members: memberships.length, eligible: audience.size }
}

export async function getVenueAnnouncementDailyUsage(
  merchantId: string
): Promise<VenueAnnouncementDailyUsage> {
  const usage = await peekRateLimit({
    key: venueAnnouncementDailyLimitKey({
      merchantId,
      businessDate: londonBusinessDate(new Date()),
    }),
    limit: VENUE_ANNOUNCEMENT_DAILY_LIMIT,
    windowMs: VENUE_ANNOUNCEMENT_DAILY_WINDOW_MS,
  })

  return { used: usage.used, limit: usage.limit }
}

export async function enqueueVenueAnnouncement(
  input: VenueAnnouncementInput
): Promise<VenueAnnouncementResult> {
  const validated = validateVenueAnnouncementText(input)
  if (!validated.ok) {
    throw new Error(validated.error)
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select("id, customer_id")
    .eq("merchant_id", input.merchantId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 500)

  if (error) {
    throw new Error(`Unable to load announcement audience: ${error.message}`)
  }

  const memberships = normalizeVenueAnnouncementMemberships(data)
  if (memberships.length === 0) {
    return { eligible: 0, queued: 0, skipped: 0 }
  }

  const audience = await resolveAnnouncementAudience(
    memberships,
    input.merchantId
  )
  let queued = 0
  let skipped = 0

  for (const membership of memberships) {
    if (!audience.has(membership.customerId)) {
      skipped += 1
      continue
    }

    const result = await enqueueNotificationEvent({
      eventType: "venue_announcement",
      customerId: membership.customerId,
      merchantId: input.merchantId,
      membershipId: membership.id,
      dedupeKey: venueAnnouncementDedupeKey({
        merchantId: input.merchantId,
        customerId: membership.customerId,
        title: validated.title,
        body: validated.body,
      }),
      payload: {
        businessName: input.businessName,
        announcementTitle: validated.title,
        announcementBody: validated.body,
        url: `/card/${membership.id}`,
      },
      metadata: {
        source: "merchant_console",
        actor_id: input.actorId,
      },
    })

    if (result.status === "queued") {
      queued += 1
    } else {
      skipped += 1
    }
  }

  void recordAnnouncementProductEvent(input, { queued, skipped })
  return { eligible: audience.size, queued, skipped }
}

async function resolveAnnouncementAudience(
  memberships: readonly VenueAnnouncementMembership[],
  merchantId: string
) {
  const supabase = createSupabaseServiceRoleClient()
  const customerIds = [...new Set(memberships.map((row) => row.customerId))]
  const [preferences, subscriptions, consents] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("customer_id, marketing_enabled")
      .in("customer_id", customerIds),
    supabase
      .from("push_subscriptions")
      .select("customer_id")
      .in("customer_id", customerIds)
      .eq("enabled", true)
      .is("revoked_at", null),
    supabase
      .from("consent_records")
      .select("customer_id, channel, consent_status, created_at")
      .eq("merchant_id", merchantId)
      .eq("channel", "push")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false }),
  ])

  if (preferences.error) {
    throw new Error(
      `Unable to load announcement preferences: ${preferences.error.message}`
    )
  }
  if (subscriptions.error) {
    throw new Error(
      `Unable to load announcement subscriptions: ${subscriptions.error.message}`
    )
  }
  if (consents.error) {
    throw new Error(
      `Unable to load announcement consent: ${consents.error.message}`
    )
  }

  return resolveVenueAnnouncementAudienceCustomerIds({
    memberships,
    preferences: preferences.data,
    subscriptions: subscriptions.data,
    consents: consents.data,
  })
}

async function recordAnnouncementProductEvent(
  input: VenueAnnouncementInput,
  result: Pick<VenueAnnouncementResult, "queued" | "skipped">
) {
  try {
    await recordProductEvent({
      eventName: "push_venue_announcement_queued",
      merchantId: input.merchantId,
      actorType: "merchant",
      actorId: input.actorId ?? input.merchantId,
      metadata: {
        queued: result.queued,
        skipped: result.skipped,
      },
    })
  } catch (error) {
    logger.warn("push_venue_announcement_product_event_failed", { error })
  }
}
