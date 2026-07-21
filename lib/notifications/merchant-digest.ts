import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  getMerchantDashboardData,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import { buildMerchantWeeklyDigestEmail } from "./merchant-digest-email"
import { londonWeekStart } from "./london-time"
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
const PAGE_SIZE = 100

type MerchantDigestClaim =
  | { readonly status: "claimed"; readonly leaseId: string }
  | { readonly status: "sent" | "busy"; readonly leaseId: null }

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
      throw new Error(
        `Unable to list weekly digest merchants: ${error.message}`
      )
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
  const periodStart = londonWeekStart(now)

  for (const merchant of merchants) {
    result.attempted += 1
    let leaseId: string | null = null

    try {
      const claim = await claimMerchantWeeklyDigest(
        merchant.id,
        periodStart,
        now
      )
      if (claim.status !== "claimed") {
        result.skipped += 1
        continue
      }
      leaseId = claim.leaseId

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
        idempotencyKey: `merchant-digest:${merchant.id}:${periodStart}`,
      })
      await completeMerchantWeeklyDigest(merchant.id, periodStart, leaseId, now)

      result.sent += 1
    } catch (error) {
      if (leaseId) {
        await failMerchantWeeklyDigest(
          merchant.id,
          periodStart,
          leaseId,
          "send_failed",
          now
        ).catch(() => undefined)
      }
      result.failed += 1
      logger.warn("merchant_weekly_digest_send_failed", {
        merchantId: merchant.id,
        reason: error instanceof Error ? error.name : "unknown_error",
      })
      continue
    }

    await recordProductEvent({
      eventName: DIGEST_EVENT_NAME,
      merchantId: merchant.id,
      actorType: "system",
      metadata: { periodStart, source: "merchant_weekly_digest" },
    }).catch(() =>
      logger.warn("merchant_weekly_digest_event_failed", {
        merchantId: merchant.id,
      })
    )
  }

  return result
}

async function claimMerchantWeeklyDigest(
  merchantId: string,
  periodStart: string,
  now = new Date()
): Promise<MerchantDigestClaim> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("claim_merchant_weekly_digest", {
    p_merchant_id: merchantId,
    p_period_start: periodStart,
    p_now: now.toISOString(),
  })

  if (error) {
    throw new Error(`Unable to claim weekly digest: ${error.message}`)
  }

  const row = data?.[0]
  if (
    row?.claim_status === "claimed" &&
    typeof row.claim_lease_id === "string"
  ) {
    return { status: "claimed", leaseId: row.claim_lease_id }
  }
  if (row?.claim_status === "sent" || row?.claim_status === "busy") {
    return { status: row.claim_status, leaseId: null }
  }
  throw new Error("Weekly digest claim returned an invalid result")
}

async function completeMerchantWeeklyDigest(
  merchantId: string,
  periodStart: string,
  leaseId: string,
  now: Date
) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "complete_merchant_weekly_digest",
    {
      p_merchant_id: merchantId,
      p_period_start: periodStart,
      p_lease_id: leaseId,
      p_now: now.toISOString(),
    }
  )
  if (error || data !== true) {
    throw new Error("Unable to complete weekly digest claim")
  }
}

async function failMerchantWeeklyDigest(
  merchantId: string,
  periodStart: string,
  leaseId: string,
  errorCode: string,
  now: Date
) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("fail_merchant_weekly_digest", {
    p_merchant_id: merchantId,
    p_period_start: periodStart,
    p_lease_id: leaseId,
    p_error_code: errorCode,
    p_now: now.toISOString(),
  })
  if (error) throw new Error("Unable to fail weekly digest claim")
}

function isMerchantDigestEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim()
  )
}
