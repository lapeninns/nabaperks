import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runObservedCron } from "@/lib/observability/cron-run"
import { logger } from "@/lib/observability/logger"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STALE_CUSTOMER_PII_RETENTION_DAYS = 365
const ABANDONED_IDENTITY_RETENTION_DAYS = 7
const WEB_VITAL_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  const observed = await runObservedCron({
    job: "privacy-retention",
    run: runPrivacyRetention,
    isSuccessful: ({ errorCode }) => errorCode === null,
    failureCode: ({ errorCode }) => errorCode ?? "partial_failure",
  })

  return observed.ok
    ? noStoreJson({ ok: true, result: observed.value.result })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}

async function runPrivacyRetention() {
  const cutoff = new Date(
    Date.now() - STALE_CUSTOMER_PII_RETENTION_DAYS * DAY_MS
  ).toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const abandonedCutoff = new Date(
    Date.now() - ABANDONED_IDENTITY_RETENTION_DAYS * DAY_MS
  ).toISOString()
  const { data: abandonedData, error: abandonedError } = await supabase.rpc(
    "admin_purge_abandoned_customer_identities",
    { p_cutoff: abandonedCutoff }
  )
  if (abandonedError) {
    logger.warn("privacy_abandoned_identity_purge_failed", {
      reason: "database_rejected",
    })
    return {
      errorCode: "abandoned_identity_purge_failed",
      result: null,
    }
  }
  const { data, error } = await supabase.rpc("admin_purge_stale_customer_pii", {
    p_cutoff: cutoff,
  })

  if (error) {
    logger.warn("privacy_retention_purge_failed", { reason: error.message })
    return { errorCode: "purge_failed", result: null }
  }

  // Expire + scrub lapsed reward invites, and hard-delete old terminal ones. A
  // failure here is logged but does not fail the customer-PII purge above.
  const { data: expiredInvites, error: inviteError } = await supabase.rpc(
    "expire_and_purge_reward_invites"
  )
  if (inviteError) {
    logger.warn("privacy_retention_invite_purge_failed", {
      reason: inviteError.message,
    })
  }

  // Expire lapsed loyalty invitations, scrub their contact, purge abandoned
  // drafts (24h) and hard-delete contact-free terminal recipients (365d).
  const { data: expiredLoyaltyInvites, error: loyaltyInviteError } =
    await supabase.rpc("expire_and_purge_loyalty_invites")
  if (loyaltyInviteError) {
    logger.warn("privacy_retention_loyalty_invite_purge_failed", {
      reason: loyaltyInviteError.message,
    })
  }

  // Drop rate-limit buckets whose window ended over 24h ago — per-IP/email
  // keys otherwise accumulate forever (db integrity hardening).
  const { data: purgedBuckets, error: bucketError } = await supabase.rpc(
    "purge_stale_rate_limit_buckets"
  )
  if (bucketError) {
    logger.warn("privacy_retention_bucket_purge_failed", {
      reason: bucketError.message,
    })
  }

  const webVitalCutoff = new Date(
    Date.now() - WEB_VITAL_RETENTION_DAYS * DAY_MS
  ).toISOString()
  const { data: purgedWebVitals, error: webVitalError } = await supabase.rpc(
    "purge_web_vital_samples",
    { p_cutoff: webVitalCutoff }
  )
  if (webVitalError) {
    logger.warn("privacy_retention_web_vital_purge_failed", {
      reason: webVitalError.message,
    })
  }

  // Replay-consumption evidence for the auth hooks. The signature window is
  // ±300s, so a day is generous; leaving these forever would grow unbounded.
  const { data: purgedAuthHooks, error: authHookError } = await supabase.rpc(
    "purge_auth_hook_deliveries"
  )
  if (authHookError) {
    logger.warn("privacy_retention_auth_hook_purge_failed", {
      reason: authHookError.message,
    })
  }

  const partialFailure =
    inviteError ||
    loyaltyInviteError ||
    bucketError ||
    webVitalError ||
    authHookError

  return {
    errorCode: partialFailure ? "partial_failure" : null,
    result: {
      cutoff,
      abandonedCutoff,
      abandonedIdentityPurgedCount:
        typeof abandonedData === "number" ? abandonedData : 0,
      purgedCount: typeof data === "number" ? data : 0,
      expiredInviteCount:
        typeof expiredInvites === "number" ? expiredInvites : 0,
      expiredLoyaltyInviteCount:
        typeof expiredLoyaltyInvites === "number" ? expiredLoyaltyInvites : 0,
      purgedRateLimitBuckets:
        typeof purgedBuckets === "number" ? purgedBuckets : 0,
      purgedAuthHookDeliveries:
        typeof purgedAuthHooks === "number" ? purgedAuthHooks : 0,
      webVitalCutoff,
      purgedWebVitalSamples:
        typeof purgedWebVitals === "number" ? purgedWebVitals : 0,
    },
  }
}
