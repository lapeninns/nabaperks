import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

function blockBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle)
  const end = source.indexOf(endNeedle, start + startNeedle.length)

  if (start === -1 || end === -1) return ""
  return source.slice(start, end)
}

describe("contract-merchant-venue-announcements-ui source contract", () => {
  it("keeps route validation, daily rate-limit, and enqueue path server-side", () => {
    const route = readProjectFile(
      "app/api/notifications/venue-announcements/route.ts"
    )

    assert.match(route, /const merchant = await getCurrentMerchant\(\)/)
    assert.match(route, /merchant\.status !== "active"/)
    assert.match(route, /getLaunchBillingReadiness/)
    assert.match(route, /isLaunchBillingReady\(billing\)/)
    assert.match(route, /validateVenueAnnouncementText/)
    assert.match(route, /venueAnnouncementDailyLimitKey/)
    assert.match(route, /businessDate: londonBusinessDate\(new Date\(\)\)/)
    assert.match(route, /limit: VENUE_ANNOUNCEMENT_DAILY_LIMIT/)
    assert.match(route, /windowMs: VENUE_ANNOUNCEMENT_DAILY_WINDOW_MS/)
    assert.match(route, /enqueueVenueAnnouncement/)
    assert.doesNotMatch(route, /getVenueAnnouncementAudienceSummary/)
  })

  it("adds a read-only audience summary that shares the send eligibility resolver", () => {
    const announcements = readProjectFile(
      "lib/notifications/venue-announcements.ts"
    )
    const summaryHelper = blockBetween(
      announcements,
      "export async function getVenueAnnouncementAudienceSummary",
      "export async function enqueueVenueAnnouncement"
    )

    assert.match(announcements, /export type VenueAnnouncementAudienceSummary/)
    assert.match(summaryHelper, /\.from\("customer_memberships"\)/)
    assert.match(summaryHelper, /\.select\("id, customer_id"\)/)
    assert.match(summaryHelper, /normalizeVenueAnnouncementMemberships\(data\)/)
    assert.match(
      summaryHelper,
      /resolveAnnouncementAudience\(\s*memberships,\s*merchantId\s*\)/
    )
    assert.match(
      announcements,
      /chunkVenueAnnouncementCustomerIds\(customerIds\)/
    )
    assert.match(announcements, /\.in\("customer_id", customerIdBatch\)/)
    assert.doesNotMatch(summaryHelper, /enqueueNotificationEvent/)
  })

  it("renders the merchant announcements page with server auth and audience preview", () => {
    const page = readProjectFile("app/app/announcements/page.tsx")

    assert.match(page, /export const dynamic = "force-dynamic"/)
    assert.match(page, /getCurrentMerchant/)
    assert.match(page, /redirect\("\/app\/onboarding"\)/)
    assert.match(page, /getVenueAnnouncementAudienceSummary\(merchant\.id\)/)
    assert.match(page, /getVenueAnnouncementDailyUsage\(merchant\.id\)/)
    assert.match(page, /dailyUsage=\{dailyUsage\}/)
    assert.match(page, /<AnnouncementCompose/)
  })

  it("posts from the client form to the existing API without importing server-only core code", () => {
    const form = readProjectFile(
      "components/merchant/announcements/announcement-compose.tsx"
    )
    const copy = readProjectFile(
      "lib/notifications/venue-announcement-form-copy.ts"
    )

    assert.match(form, /"use client"/)
    assert.match(form, /fetch\("\/api\/notifications\/venue-announcements"/)
    assert.match(form, /maxLength=\{80\}/)
    assert.match(form, /maxLength=\{180\}/)
    assert.match(form, /Daily announcements/)
    assert.match(form, /dailyUsage\.used/)
    assert.match(form, /dailyUsage\.limit/)
    assert.match(form, /venueAnnouncementFormErrorCopy/)
    assert.match(copy, /rate_limited/)
    assert.doesNotMatch(form, /venue-announcement-core/)
    assert.doesNotMatch(form, /use server/)
  })

  it("adds sidebar and home entry points for the announcements route", () => {
    const nav = readProjectFile("components/layout/console-nav.ts")
    const homeActions = readProjectFile(
      "components/merchant/dashboard-header-actions.tsx"
    )
    const navBlock = blockBetween(
      nav,
      "export const merchantNavItems = [",
      "] satisfies readonly ShellNavItem[]"
    )

    assert.match(nav, /Megaphone01Icon/)
    assert.match(navBlock, /href: "\/app\/announcements"/)
    assert.match(navBlock, /label: "Announce"/)
    assert.match(homeActions, /href="\/app\/announcements"/)
  })

  it("registers a DB-free harness route for browser, a11y, and visual sweeps", () => {
    const harness = readProjectFile("tests/e2e/helpers/harness.ts")
    const page = readProjectFile("app/dev/app-harness/announcements/page.tsx")
    const client = readProjectFile(
      "app/dev/app-harness/announcements/harness-client.tsx"
    )

    assert.match(harness, /announcements: "\/dev\/app-harness\/announcements"/)
    assert.match(page, /AnnouncementsHarnessClient/)
    assert.match(client, /AnnouncementCompose/)
    assert.match(client, /submitAnnouncement/)
    assert.match(client, /eligible: 18/)
    assert.match(client, /eligible: 0/)
  })
})
