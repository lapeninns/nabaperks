import "server-only"

import { getServerEnv } from "@/lib/env/server"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { sendTransactionalEmail } from "@/lib/notifications/resend"
import {
  deliverQrStatusEmail,
  type QrStatusDeliveryRow,
} from "@/lib/notifications/qr-status-worker-core"

export async function drainQrStatusEmails(
  merchantId?: string
): Promise<{ sent: number; failed: number }> {
  try {
    const service = createSupabaseServiceRoleClient()
    const { data, error } = await service.rpc("claim_qr_status_emails", {
      p_merchant_id: merchantId ?? null,
      p_limit: 20,
    })
    if (error) throw new Error("claim_failed")
    const rows = data as QrStatusDeliveryRow[]
    const workspaceUrl = new URL("/app/qr", getServerEnv().NEXT_PUBLIC_APP_URL)
      .href
    const results = await Promise.all(
      rows.map((row) =>
        deliverQrStatusEmail({
          row,
          workspaceUrl,
          send: (input) =>
            sendTransactionalEmail({
              ...input,
              signal: AbortSignal.timeout(15_000),
              beforeProviderAttempt: async () => {
                const now = new Date()
                const { data: live, error: leaseError } = await service
                  .from("qr_status_email_outbox")
                  .select("id")
                  .eq("id", row.id)
                  .eq("lease_id", row.lease_id)
                  .eq("status", "sending")
                  .gt("lease_until", now.toISOString())
                  .gt(
                    "changed_at",
                    new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()
                  )
                  .maybeSingle()
                if (leaseError || !live)
                  throw new Error("delivery_lease_expired")
              },
            }),
          finish: async (outcome) => {
            const { data: finished, error: finishError } = await service.rpc(
              "finish_qr_status_email",
              {
                p_id: row.id,
                p_lease_id: row.lease_id,
                p_outcome: outcome,
              }
            )
            return !finishError && finished === true
          },
        })
      )
    )
    const sent = results.filter(Boolean).length
    if (sent !== rows.length)
      logger.warn("qr_status_email_delivery_incomplete", {
        failed: rows.length - sent,
      })
    return { sent, failed: rows.length - sent }
  } catch {
    logger.warn("qr_status_email_drain_failed", {
      reason: "delivery_unavailable",
    })
    return { sent: 0, failed: 1 }
  }
}
