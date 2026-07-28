import "server-only"

import { decryptCustomerEmail } from "@/lib/customer/email-encryption-core"
import {
  LOYALTY_INVITE_DRAIN_MAX_PER_RUN,
  LOYALTY_INVITE_LINK_TTL_DAYS,
  LOYALTY_INVITE_RESEND_MAX_RPS,
} from "@/lib/loyalty-invites/constants"
import {
  inviteIdempotencyKey,
  nextRetryDueAtMs,
} from "@/lib/loyalty-invites/delivery-core"
import {
  inviteClaimToken,
  inviteUnsubscribeToken,
} from "@/lib/loyalty-invites/tokens"
import { buildLoyaltyInviteEmail } from "@/lib/notifications/loyalty-invite-email"
import { readEmailOtpConfig } from "@/lib/notifications/resend"
import { buildTransactionalEmailPayload } from "@/lib/notifications/transactional-email-payload"
import { logger } from "@/lib/observability/logger"
import { absoluteUrl } from "@/lib/seo/structured-data"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Durable drain worker for bulk loyalty invitations. A five-minute cron leases
 * up to 800 due recipients (skip-locked), decrypts each address only in-process,
 * rebuilds the claim/unsubscribe URLs from the recipient id (tokens are never
 * stored), and sends via Resend with a stable per-recipient idempotency key.
 * Sends are paced to at most four Resend requests per second. Transient
 * failures (network / 429 / 5xx) are re-queued with 15-minute then two-hour
 * backoffs (three attempts total); permanent failures do not retry.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails"

type LeasedRecipient = {
  recipient_id: string
  campaign_id: string
  merchant_id: string
  email_ciphertext: string | null
  attempt_count: number
  business_name: string | null
  business_slug: string | null
  link_expires_at: string | null
}

type SendOutcome = "sent" | "retry" | "failed"

type LoyaltyInviteEmail = {
  readonly subject: string
  readonly text: string
  readonly html: string
}

export type LoyaltyInviteDeliverySink = (input: {
  readonly to: string
  readonly email: LoyaltyInviteEmail
  readonly idempotencyKey: string
}) => Promise<{ status: number | null; providerId: string | null }>

export type LoyaltyInviteDrainResult = {
  drained: number
  sent: number
  retried: number
  failed: number
  skipped?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runLoyaltyInviteDrain(options?: {
  maxEmails?: number
  /**
   * Test/staging proof seam. Runtime callers omit this and use Resend. A
   * synthetic sink can capture the fully rendered email without any network
   * delivery; it is never selected by environment configuration.
   */
  deliverySink?: LoyaltyInviteDeliverySink
}): Promise<LoyaltyInviteDrainResult> {
  let deliverySink = options?.deliverySink
  if (!deliverySink) {
    try {
      const config = readEmailOtpConfig()
      deliverySink = (input) => sendOne(config, input)
    } catch {
      logger.warn("loyalty_invite_drain_unconfigured", {})
      return {
        drained: 0,
        sent: 0,
        retried: 0,
        failed: 0,
        skipped: "resend_unconfigured",
      }
    }
  }

  const supabase = createSupabaseServiceRoleClient()
  const limit = Math.min(
    options?.maxEmails ?? LOYALTY_INVITE_DRAIN_MAX_PER_RUN,
    LOYALTY_INVITE_DRAIN_MAX_PER_RUN
  )

  const { data, error } = await supabase.rpc(
    "claim_due_loyalty_invite_recipients",
    { p_now: new Date().toISOString(), p_limit: limit }
  )
  if (error) {
    logger.warn("loyalty_invite_drain_lease_failed", {
      reason: "database_rejected",
    })
    return {
      drained: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: "lease_failed",
    }
  }

  const leased = (data ?? []) as LeasedRecipient[]
  const totals = { sent: 0, retried: 0, failed: 0 }
  const chunkSize = Math.max(LOYALTY_INVITE_RESEND_MAX_RPS, 1)

  for (let i = 0; i < leased.length; i += chunkSize) {
    const chunk = leased.slice(i, i + chunkSize)
    const startedAt = Date.now()
    const outcomes = await Promise.all(
      chunk.map((recipient) =>
        processRecipient(supabase, deliverySink, recipient)
      )
    )
    for (const outcome of outcomes) {
      if (outcome === "sent") totals.sent += 1
      else if (outcome === "failed") totals.failed += 1
      else totals.retried += 1
    }
    // Cap at chunkSize sends per second.
    if (i + chunkSize < leased.length) {
      const elapsed = Date.now() - startedAt
      if (elapsed < 1000) await sleep(1000 - elapsed)
    }
  }

  return { drained: leased.length, ...totals }
}

async function processRecipient(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  deliverySink: LoyaltyInviteDeliverySink,
  recipient: LeasedRecipient
): Promise<SendOutcome> {
  let to = ""
  try {
    to = recipient.email_ciphertext
      ? decryptCustomerEmail(recipient.email_ciphertext)
      : ""
  } catch {
    to = ""
  }
  if (!to) {
    await settle(
      supabase,
      recipient.recipient_id,
      "failed",
      null,
      null,
      "no_ciphertext"
    )
    return "failed"
  }

  const claimToken = inviteClaimToken(recipient.recipient_id)
  const unsubscribeToken = inviteUnsubscribeToken(recipient.recipient_id)
  const email = buildLoyaltyInviteEmail({
    businessName: recipient.business_name ?? "",
    claimUrl: absoluteUrl(`/invite/${claimToken}`),
    unsubscribeUrl: absoluteUrl(`/invite/unsubscribe/${unsubscribeToken}`),
    privacyUrl: absoluteUrl("/privacy"),
    expiryDays: LOYALTY_INVITE_LINK_TTL_DAYS,
  })

  const { status, providerId } = await deliverySink({
    to,
    email,
    idempotencyKey: inviteIdempotencyKey(recipient.recipient_id),
  })

  if (status !== null && status >= 200 && status < 300) {
    await settle(
      supabase,
      recipient.recipient_id,
      "sent",
      providerId,
      null,
      null
    )
    return "sent"
  }

  const dueAtMs = nextRetryDueAtMs(recipient.attempt_count, status, Date.now())
  const reason = `status_${status ?? "network"}`
  if (dueAtMs === null) {
    await settle(supabase, recipient.recipient_id, "failed", null, null, reason)
    return "failed"
  }
  await settle(
    supabase,
    recipient.recipient_id,
    "retry",
    null,
    new Date(dueAtMs).toISOString(),
    reason
  )
  return "retry"
}

async function sendOne(
  config: { apiKey: string; from: string },
  { to, email, idempotencyKey }: Parameters<LoyaltyInviteDeliverySink>[0]
): Promise<{ status: number | null; providerId: string | null }> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(
        buildTransactionalEmailPayload(config.from, {
          to,
          subject: email.subject,
          text: email.text,
          html: email.html,
        })
      ),
    })
    if (!res.ok) return { status: res.status, providerId: null }
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null
    const providerId = typeof body?.id === "string" ? body.id : null
    return { status: res.status, providerId }
  } catch {
    // Network error / fetch threw — transient.
    return { status: null, providerId: null }
  }
}

async function settle(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  recipientId: string,
  outcome: SendOutcome,
  providerId: string | null,
  nextAttemptAt: string | null,
  reason: string | null
): Promise<void> {
  const { error } = await supabase.rpc("settle_loyalty_invite_send", {
    p_recipient_id: recipientId,
    p_outcome: outcome,
    p_provider_message_id: providerId,
    p_next_attempt_at: nextAttemptAt,
    p_failure_reason: reason,
  })
  if (error) {
    logger.warn("loyalty_invite_settle_failed", { reason: "database_rejected" })
  }
}
