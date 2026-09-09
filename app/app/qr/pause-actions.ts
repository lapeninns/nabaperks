"use server"

import { randomInt } from "node:crypto"
import { after } from "next/server"

import { getCurrentUser, getCurrentMerchant } from "@/lib/auth/session"
import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import {
  isQrPauseComplete,
  maskQrOwnerEmail,
  qrPauseResult,
  type QrPauseState,
} from "@/lib/merchant/qr-pause-state"
import { buildQrPauseCodeEmail } from "@/lib/notifications/qr-status-email"
import { drainQrStatusEmails } from "@/lib/notifications/qr-status-worker"
import { sendTransactionalEmail } from "@/lib/notifications/resend"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type IssuedChallenge = {
  status: string
  challenge_id?: string
  email?: string
  venue_name?: string
  retry_at?: string
}

export async function requestQrPauseCode(
  qrCodeId: string
): Promise<QrPauseState> {
  if (!UUID.test(qrCodeId)) return qrPauseResult("unavailable")
  try {
    const user = await getCurrentUser()
    if (!user?.email || !user.email_confirmed_at)
      return qrPauseResult("email_required")
    const service = createSupabaseServiceRoleClient()
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0")
    const { data, error } = await service.rpc("issue_qr_pause_challenge", {
      p_owner_user_id: user.id,
      p_qr_code_id: qrCodeId,
      p_code: code,
    })
    if (error) return qrPauseResult("unavailable")
    const issued = data as IssuedChallenge
    if (
      issued.status !== "issued" ||
      !issued.challenge_id ||
      !issued.email ||
      !issued.venue_name
    ) {
      return { ...qrPauseResult(issued.status), retryAt: issued.retry_at }
    }
    try {
      await sendTransactionalEmail({
        to: issued.email,
        signal: AbortSignal.timeout(15_000),
        ...buildQrPauseCodeEmail(issued.venue_name, code),
        idempotencyKey: `qr-pause-code:${issued.challenge_id}`,
      })
      const { data: activated, error: activationError } = await service
        .from("qr_pause_challenges")
        .update({ state: "ready" })
        .eq("id", issued.challenge_id)
        .eq("state", "sending")
        .select("id")
        .maybeSingle()
      if (activationError || !activated) throw new Error("challenge_not_ready")
    } catch {
      await service
        .from("qr_pause_challenges")
        .update({ state: "revoked" })
        .eq("id", issued.challenge_id)
        .eq("state", "sending")
      return {
        status: "delivery_failed",
        message:
          "Could not send a usable verification code. Scans are unchanged. Wait a minute and request a new code.",
        retryAt: issued.retry_at,
      }
    }
    return {
      status: "sent",
      message:
        "Verification code sent. It expires in 10 minutes. Your QR status is unchanged.",
      challengeId: issued.challenge_id,
      maskedEmail: maskQrOwnerEmail(issued.email),
      retryAt: issued.retry_at,
    }
  } catch {
    return qrPauseResult("unavailable")
  }
}

export async function verifyQrPauseCode(
  qrCodeId: string,
  challengeId: string,
  code: string
): Promise<QrPauseState> {
  if (!UUID.test(qrCodeId) || !UUID.test(challengeId))
    return qrPauseResult("unavailable")
  try {
    const merchant = await getCurrentMerchant()
    if (!merchant) return qrPauseResult("unavailable")
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc("verify_and_pause_qr", {
      p_qr_code_id: qrCodeId,
      p_challenge_id: challengeId,
      p_code: code.trim().slice(0, 32),
    })
    if (error) return qrPauseResult("unavailable")
    const result = qrPauseResult(String(data?.status))
    if (isQrPauseComplete(result.status)) {
      // Follow-through failure must never turn a committed pause into an error.
      try {
        revalidateMerchantLaunchSurfaces(merchant.id)
        after(() => drainQrStatusEmails(merchant.id))
      } catch {
        // The durable outbox is still drained by cron.
      }
    }
    return result
  } catch {
    return qrPauseResult("unavailable")
  }
}
