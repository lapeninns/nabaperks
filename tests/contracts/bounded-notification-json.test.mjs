import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
}

test("notification mutation routes use the bounded JSON reader", () => {
  for (const path of [
    "app/api/notifications/venue-announcements/route.ts",
    "app/api/notifications/push/subscribe/route.ts",
    "app/api/notifications/push/refresh/route.ts",
    "app/api/notifications/push/preferences/route.ts",
    "app/api/notifications/push/disable-subscription-handler.ts",
  ]) {
    const route = source(path)
    assert.match(route, /readBoundedJsonRequest/)
    assert.doesNotMatch(route, /request\.json\(/)
  }
})

test("announcement attempts are charged before parsing while valid sends retain the daily limit", () => {
  const route = source("app/api/notifications/venue-announcements/route.ts")
  const attempt = route.indexOf("key: venueAnnouncementAttemptLimitKey")
  const parse = route.indexOf("await readBoundedJsonRequest")
  const daily = route.indexOf("key: venueAnnouncementDailyLimitKey")
  assert.ok(attempt >= 0 && attempt < parse)
  assert.ok(parse < daily)
  assert.match(route, /MAX_VENUE_ANNOUNCEMENT_BODY_BYTES = 2_048/)
})

test("all push mutations share a pre-parse account budget and an 8 KiB ceiling", () => {
  for (const path of [
    "app/api/notifications/push/subscribe/route.ts",
    "app/api/notifications/push/refresh/route.ts",
    "app/api/notifications/push/preferences/route.ts",
    "app/api/notifications/push/disable-subscription-handler.ts",
  ]) {
    const route = source(path)
    const routeSpecific = route.indexOf("await enforceRateLimit")
    const shared = route.indexOf("await enforcePushMutationRateLimit")
    assert.ok(
      routeSpecific >= 0 &&
        routeSpecific < shared &&
        shared < route.indexOf("await readBoundedJsonRequest")
    )
    assert.match(route, /MAX_PUSH_MUTATION_BODY_BYTES = 8_192/)
  }
  assert.match(
    source("lib/notifications/push-mutation-rate-limit.ts"),
    /key: `push-mutation:\$\{customerId\}`/
  )
})
