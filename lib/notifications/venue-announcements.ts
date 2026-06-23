import "server-only"

import { createHash } from "node:crypto"

import { recordProductEvent } from "@/lib/analytics/events"
import { enqueueNotificationEvent } from "@/lib/notifications/events"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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

type MembershipRow = {
  id: string
  customer_id: string
}

type PreferenceRow = {
  customer_id: string
  marketing_enabled: boolean
}

type SubscriptionRow = {
  customer_id: string
}

type ConsentRow = {
  customer_id: string
  channel: string
  consent_status: string
  created_at: string
}

export function validateVenueAnnouncementText(input: {
  title: unknown
  body: unknown
}):
  | { ok: true; title: string; body: string }
  | { ok: false; error: "invalid_title" | "invalid_body" } {
  const title = cleanText(input.title, 80)
  const body = cleanText(input.body, 180)

  if (title.length < 3) return { ok: false, error: "invalid_title" }
  if (body.length < 10) return { ok: false, error: "invalid_body" }

  return { ok: true, title, body }
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

  const memberships = ((data ?? []) as MembershipRow[]).filter(
    (row) => row.id && row.customer_id
  )
  if (memberships.length === 0) {
    return { eligible: 0, queued: 0, skipped: 0 }
  }

  const audience = await resolveAnnouncementAudience(
    memberships,
    input.merchantId
  )
  let queued = 0
  let skipped = 0
  const digest = announcementDigest(input.merchantId, validated.title, validated.body)

  for (const membership of memberships) {
    if (!audience.has(membership.customer_id)) {
      skipped += 1
      continue
    }

    const result = await enqueueNotificationEvent({
      eventType: "venue_announcement",
      customerId: membership.customer_id,
      merchantId: input.merchantId,
      membershipId: membership.id,
      dedupeKey: `venue_announcement:${input.merchantId}:${membership.customer_id}:${digest}`,
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
  memberships: MembershipRow[],
  merchantId: string
) {
  const supabase = createSupabaseServiceRoleClient()
  const customerIds = [...new Set(memberships.map((row) => row.customer_id))]
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

  const enabledPreference = new Set(
    ((preferences.data ?? []) as PreferenceRow[])
      .filter((row) => row.marketing_enabled)
      .map((row) => row.customer_id)
  )
  const enabledSubscription = new Set(
    ((subscriptions.data ?? []) as SubscriptionRow[]).map(
      (row) => row.customer_id
    )
  )
  const consentAllowed = resolveLatestConsent(
    (consents.data ?? []) as ConsentRow[]
  )

  return new Set(
    customerIds.filter(
      (customerId) =>
        enabledPreference.has(customerId) &&
        enabledSubscription.has(customerId) &&
        consentAllowed.has(customerId)
    )
  )
}

function resolveLatestConsent(rows: ConsentRow[]) {
  const latest = new Map<string, string>()
  for (const row of rows) {
    const key = `${row.customer_id}:${row.channel}`
    if (!latest.has(key)) latest.set(key, row.consent_status)
  }

  const allowed = new Set<string>()
  for (const [key, status] of latest.entries()) {
    if (status === "opted_in") {
      allowed.add(key.split(":")[0] ?? "")
    }
  }
  allowed.delete("")
  return allowed
}

function announcementDigest(merchantId: string, title: string, body: string) {
  return createHash("sha256")
    .update(`${merchantId}:${title}:${body}`)
    .digest("hex")
    .slice(0, 16)
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : ""
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
