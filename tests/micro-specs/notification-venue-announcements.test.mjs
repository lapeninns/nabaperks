import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given marketing consent spans channels When push notifications deliver Then only push consent is authoritative", () => {
  const events = readProjectFile("lib", "notifications", "events.ts")
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")
  const announcements = readProjectFile(
    "lib",
    "notifications",
    "venue-announcements.ts"
  )
  const helper = readProjectFile(
    "lib",
    "notifications",
    "push-marketing-eligibility.ts"
  )
  const core = readProjectFile(
    "lib",
    "notifications",
    "push-marketing-eligibility-core.ts"
  )

  assert.match(
    helper,
    /\.from\("consent_records"\)[\s\S]*\.eq\("channel", "push"\)[\s\S]*latestPushMarketingConsentOptedIn/
  )
  assert.match(events, /hasPushMarketingConsent/)
  assert.match(worker, /hasPushMarketingConsent/)
  assert.match(announcements, /resolveVenueAnnouncementAudienceCustomerIds/)
  assert.match(core, /pushMarketingConsentCustomerIds/)
  assert.match(core, /function isPushMarketingConsentOptedIn/)
  assert.doesNotMatch(events, /\.from\("consent_records"\)/)
  assert.doesNotMatch(worker, /\.from\("consent_records"\)/)
  assert.doesNotMatch(announcements, /function resolveLatestConsent/)
})

test("Given a merchant sends a venue announcement When source is inspected Then recipient scope is server-derived", () => {
  const route = readProjectFile(
    "app",
    "api",
    "notifications",
    "venue-announcements",
    "route.ts"
  )
  const announcements = readProjectFile(
    "lib",
    "notifications",
    "venue-announcements.ts"
  )
  const core = readProjectFile(
    "lib",
    "notifications",
    "venue-announcement-core.ts"
  )

  assert.match(route, /const merchant = await getCurrentMerchant\(\)/)
  assert.match(
    route,
    /if \(!merchant\) return json\(\{ error: "unauthenticated" \}, 401\)/
  )
  assert.match(route, /key: `venue-announcement:\$\{merchant\.id\}`/)
  assert.match(route, /limit: 4/)
  assert.match(route, /windowMs: 60 \* 60 \* 1000/)
  assert.match(route, /headers: \{ "cache-control": "no-store, max-age=0" \}/)
  assert.match(route, /validateVenueAnnouncementText/)
  assert.match(core, /moderation_rejected/)
  assert.match(core, /isModerationSafeAnnouncementText/)
  assert.match(route, /merchantId: merchant\.id/)
  assert.match(route, /businessName: merchant\.business_name/)
  assert.match(route, /actorId: merchant\.id/)
  assert.doesNotMatch(route, /merchantId:\s*(body|request)/)
  assert.doesNotMatch(route, /readString\(body, "merchant/)

  assert.match(announcements, /normalizeVenueAnnouncementMemberships\(data\)/)
  assert.match(announcements, /resolveVenueAnnouncementAudienceCustomerIds/)
  assert.match(announcements, /venueAnnouncementDedupeKey/)
  assert.match(core, /marketing_enabled === true/)
  assert.match(core, /pushMarketingConsentCustomerIds/)
  assert.match(core, /enabledSubscription\.has\(customerId\)/)
})
