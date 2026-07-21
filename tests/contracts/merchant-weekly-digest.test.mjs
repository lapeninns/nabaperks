import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

describe("contract-platform-merchant-digest-email source contract", () => {
  it("keeps Resend OTP as a wrapper around the shared transactional sender", () => {
    // Given
    const resend = readProjectFile("lib", "notifications", "resend.ts")

    // When / Then
    assert.match(resend, /export function readEmailOtpConfig/)
    assert.match(resend, /export async function sendTransactionalEmail/)
    assert.match(resend, /export async function sendEmailOtp/)
    assert.match(
      resend,
      /sendEmailOtp[\s\S]*sendTransactionalEmail\(\{[\s\S]*subject:[\s\S]*text:[\s\S]*html: otpEmailHtml/
    )
  })

  it("protects the merchant digest cron route with the shared timing-safe bearer guard", () => {
    // Given
    const route = readProjectFile(
      "app",
      "api",
      "cron",
      "merchant-digest",
      "route.ts"
    )
    const guard = readProjectFile("lib", "security", "cron-auth.ts")

    // When / Then
    assert.match(route, /export const runtime = "nodejs"/)
    assert.match(route, /export const dynamic = "force-dynamic"/)
    assert.match(route, /export const maxDuration = 300/)
    assert.match(route, /runMerchantWeeklyDigest/)
    assert.match(route, /from "@\/lib\/security\/cron-auth"/)
    assert.match(route, /isAuthorizedCronRequest\(request\)/)
    assert.match(route, /status: 401/)
    assert.match(route, /cache-control": "no-store, max-age=0"/)
    assert.match(guard, /process\.env\.CRON_SECRET/)
    assert.match(guard, /timingSafeEqual/)
  })

  it("registers the Monday morning Vercel cron schedule", () => {
    // Given
    const vercel = JSON.parse(readProjectFile("vercel.json"))

    // When
    const digestCron = vercel.crons.find(
      (cron) => cron.path === "/api/cron/merchant-digest"
    )

    // Then
    assert.deepEqual(digestCron, {
      path: "/api/cron/merchant-digest",
      schedule: "0 8 * * 1",
    })
  })

  it("claims each merchant/week before sending with provider idempotency", () => {
    // Given
    const worker = readProjectFile("lib", "notifications", "merchant-digest.ts")
    const events = readProjectFile("lib", "analytics", "events.ts")

    // When
    const claimIndex = worker.indexOf("await claimMerchantWeeklyDigest")
    const sendIndex = worker.indexOf("await sendTransactionalEmail")
    const completeIndex = worker.indexOf("await completeMerchantWeeklyDigest")

    // Then
    assert.ok(claimIndex >= 0)
    assert.ok(sendIndex > claimIndex)
    assert.ok(completeIndex > sendIndex)
    assert.match(worker, /claim_merchant_weekly_digest/)
    assert.match(worker, /fail_merchant_weekly_digest/)
    assert.match(worker, /idempotencyKey: `merchant-digest:/)
    assert.match(worker, /merchant_weekly_digest_sent/)
    assert.match(worker, /getMerchantDashboardData/)
    assert.match(worker, /status", \["trial", "active"\]/)
    assert.match(worker, /PAGE_SIZE = 100/)
    assert.doesNotMatch(worker, /Promise\.all/)
    assert.doesNotMatch(worker, /notification_events/)
    assert.match(events, /"merchant_weekly_digest_sent"/)

    const migration = readProjectFile(
      "supabase",
      "migrations",
      "20260721100000_deepsec_consistency_hardening.sql"
    )
    assert.match(migration, /primary key \(merchant_id, period_start\)/i)
    assert.match(
      migration,
      /create or replace function public\.claim_merchant_weekly_digest/i
    )
  })
})
