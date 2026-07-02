import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  getMerchantDashboardData,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import { buildMerchantWeeklyDigestEmail } from "./merchant-digest-email"
import { sendTransactionalEmail } from "./resend"

export type WeeklyDigestMerchant = MerchantDashboardMerchant & {
  readonly email: string
}

export type MerchantWeeklyDigestRunResult = {
  readonly attempted: number
  readonly sent: number
  readonly skipped: number
  readonly failed: number
  readonly notConfigured: boolean
}

const DIGEST_EVENT_NAME = "merchant_weekly_digest_sent"
const DEDUPE_WINDOW_DAYS = 6
const DEDUPE_WINDOW_MS = DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000
const PAGE_SIZE = 100

export async function listWeeklyDigestMerchants(): Promise<
  WeeklyDigestMerchant[]
> {
  const supabase = createSupabaseServiceRoleClient()
  const merchants: WeeklyDigestMerchant[] = []
  let start = 0

  while (true) {
    const end = start + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("merchants")
      .select("id, business_name, status, email")
      .in("status", ["trial", "active"])
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .range(start, end)

    if (error) {
      throw new Error(`Unable to list weekly digest merchants: ${error.message}`)
    }

    const rows = data ?? []
    for (const row of rows) {
      const email = row.email.trim()
      if (email.length === 0) continue

      merchants.push({
        id: row.id,
        business_name: row.business_name,
        status: row.status,
        email,
      })
    }

    if (rows.length < PAGE_SIZE) {
      return merchants
    }

    start += PAGE_SIZE
  }
}

export async function runMerchantWeeklyDigest({
  now = new Date(),
}: {
  readonly now?: Date
} = {}): Promise<MerchantWeeklyDigestRunResult> {
  const result = {
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    notConfigured: false,
  }

  if (!isMerchantDigestEmailConfigured()) {
    logger.warn("merchant_weekly_digest_not_configured")
    return { ...result, notConfigured: true }
  }

  const merchants = await listWeeklyDigestMerchants()

  for (const merchant of merchants) {
    result.attempted += 1

    try {
      if (await hasRecentMerchantWeeklyDigest(merchant.id, now)) {
        result.skipped += 1
        continue
      }

      const dashboard = await getMerchantDashboardData(merchant)
      const email = buildMerchantWeeklyDigestEmail({
        businessName: merchant.business_name,
        metrics: dashboard.metrics,
        trends: dashboard.trends,
      })

      await sendTransactionalEmail({
        to: merchant.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      await recordProductEvent({
        eventName: DIGEST_EVENT_NAME,
        merchantId: merchant.id,
        actorType: "system",
        metadata: {
          dedupeWindowDays: DEDUPE_WINDOW_DAYS,
          source: "merchant_weekly_digest",
        },
      })

      result.sent += 1
    } catch (error) {
      result.failed += 1
      logger.warn("merchant_weekly_digest_send_failed", {
        merchantId: merchant.id,
        reason:
          error instanceof Error
            ? error.message
            : "Unknown merchant weekly digest error",
      })
    }
  }

  return result
}

export async function hasRecentMerchantWeeklyDigest(
  merchantId: string,
  now = new Date()
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const since = new Date(now.getTime() - DEDUPE_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from("product_events")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("event_name", DIGEST_EVENT_NAME)
    .gte("created_at", since)
    .limit(1)

  if (error) {
    throw new Error(`Unable to check weekly digest dedupe: ${error.message}`)
  }

  return (data ?? []).length > 0
}

function isMerchantDigestEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim()
  )
}
