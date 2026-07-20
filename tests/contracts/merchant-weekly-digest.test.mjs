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
    const noStoreHelper = readProjectFile("lib", "http", "no-store-json.ts")

    // When / Then
    assert.match(route, /export const runtime = "nodejs"/)
    assert.match(route, /export const dynamic = "force-dynamic"/)
    assert.match(route, /export const maxDuration = 300/)
    assert.match(route, /runMerchantWeeklyDigest/)
    assert.match(route, /from "@\/lib\/security\/cron-auth"/)
    assert.match(route, /isAuthorizedCronRequest\(request\)/)
    assert.match(route, /noStoreJson\(\{ error: "unauthorized" \}, 401\)/)
    assert.match(noStoreHelper, /"cache-control": "no-store, max-age=0"/)
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

  it("dedupes successful digest sends before emailing and records the event after success", () => {
    // Given
    const worker = readProjectFile("lib", "notifications", "merchant-digest.ts")
    const events = readProjectFile("lib", "analytics", "events.ts")

    // When
    const dedupeIndex = worker.indexOf("await hasRecentMerchantWeeklyDigest")
    const sendIndex = worker.indexOf("await sendTransactionalEmail")
    const recordIndex = worker.indexOf("await recordProductEvent")

    // Then
    assert.ok(dedupeIndex >= 0)
    assert.ok(sendIndex > dedupeIndex)
    assert.ok(recordIndex > sendIndex)
    assert.match(worker, /merchant_weekly_digest_sent/)
    assert.match(worker, /getMerchantDashboardData/)
    assert.match(worker, /status", \["trial", "active"\]/)
    assert.match(worker, /PAGE_SIZE = 100/)
    assert.doesNotMatch(worker, /Promise\.all/)
    assert.doesNotMatch(worker, /notification_events/)
    assert.match(events, /"merchant_weekly_digest_sent"/)
  })
})
