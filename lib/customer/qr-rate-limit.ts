import "server-only"

import {
  qrScanCodeRateLimitKey,
  qrScanIdentityRateLimitKey,
} from "@/lib/customer/qr-rate-limit-core"
import {
  RateLimitError,
  enforceRateLimit,
  rateLimitBucketHash,
} from "@/lib/security/rate-limit"
import { isMissingRpcError } from "@/lib/supabase/missing-rpc"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Mirrors of the limits baked into `public.admit_qr_scan`; used only by the
 * one-release fallback below and pinned against the migration by contract test.
 */
export const qrScanIdentityRateLimit = 120
export const qrScanCodeRateLimit = 60
export const qrScanRateLimitWindowMs = 60_000

type QrScanRateLimitInput = {
  readonly qrId: string
  readonly identity: string
}

/**
 * Admit one public QR scan. Both buckets (identity-wide and per-code) are
 * debited inside a single RPC transaction, so a rejection rolls back the
 * identity debit too — a refused scan no longer eats the wider budget. The
 * bucket keys are the same strings the two former `enforceRateLimit` calls
 * used, so existing rows in `rate_limit_buckets` and the e2e bucket seeder
 * keep their meaning.
 */
export async function enforceQrScanRateLimit({
  qrId,
  identity,
}: QrScanRateLimitInput): Promise<void> {
  const identityKey = qrScanIdentityRateLimitKey(identity)
  const codeKey = qrScanCodeRateLimitKey(qrId, identity)
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("admit_qr_scan", {
    p_identity_bucket: rateLimitBucketHash(identityKey),
    p_code_bucket: rateLimitBucketHash(codeKey),
  })

  if (!error) return

  if (/rate limit exceeded/i.test(error.message)) {
    throw new RateLimitError()
  }

  if (isMissingRpcError(error)) {
    // The app reached production ahead of the migration: keep the previous
    // two-call shape for this release rather than refusing every scan.
    await enforceRateLimit({
      key: identityKey,
      limit: qrScanIdentityRateLimit,
      windowMs: qrScanRateLimitWindowMs,
    })
    await enforceRateLimit({
      key: codeKey,
      limit: qrScanCodeRateLimit,
      windowMs: qrScanRateLimitWindowMs,
    })
    return
  }

  throw new Error(`Unable to enforce QR scan rate limit: ${error.message}`)
}
