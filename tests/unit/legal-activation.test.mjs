import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import {
  CUSTOMER_LEGAL_VERSION,
  PLATFORM_TERMS_META,
  buildVenueTermsSections,
} from "@/lib/legal/content"

test("activation version reaches every join acceptance and its snapshot trigger", () => {
  assert.equal(CUSTOMER_LEGAL_VERSION, "2026-09-26")
  assert.match(PLATFORM_TERMS_META.eyebrow, /26 September 2026/)
  const action = readFileSync("app/m/[merchantSlug]/join/actions.ts", "utf8")
  assert.match(action, /const policyVersion = CUSTOMER_LEGAL_VERSION/)
  assert.equal(
    (action.match(/p_policy_version: policyVersion/g) ?? []).length,
    3
  )
  const migration = readFileSync(
    "supabase/migrations/20260926100000_loyalty_terms_snapshot_v20260926.sql",
    "utf8"
  )
  assert.ok(
    migration.includes(`new.policy_version <> '${CUSTOMER_LEGAL_VERSION}'`)
  )
})

test("venue terms preserve configured earning and individual reward terms", () => {
  const sections = buildVenueTermsSections({
    merchantName: "Venue",
    stampsRequired: 4,
    rewardTerms: "Venue exclusion",
    minimumSpendPence: 725,
    oneTransactionPerStamp: true,
    rewardPool: [
      {
        rewardName: "Soup",
        rewardTerms: "Lunch only",
        requiresAgeCheck: false,
      },
      { rewardName: "Wine", rewardTerms: "125ml", requiresAgeCheck: true },
    ],
  })
  const body = (id) => sections.find((section) => section.id === id)?.body
  assert.match(body("earning-rule"), /Minimum spend £7.25/)
  assert.match(body("earning-rule"), /venue trading day/)
  assert.match(body("reward"), /fresh card/)
  assert.match(body("reward-pool"), /Soup: Lunch only/)
  assert.match(body("reward-pool"), /Wine: 125ml.*Photo ID/)
  assert.doesNotMatch(body("reward-pool"), /Soup: Lunch only[^\n]*Photo ID/)
  assert.match(body("redemption"), /Email is optional/)
  assert.match(body("availability"), /grace period/)
})

test("null expiry and disabled spend terms do not invent a deadline or transaction restriction", () => {
  const sections = buildVenueTermsSections({
    merchantName: "Venue",
    stampsRequired: 2,
    rewardTerms: "",
    minimumSpendPence: null,
    oneTransactionPerStamp: false,
    tradingDayStartsAt: "06:30:00",
    rewardExpiresAfterDays: null,
  })
  const earning = sections.find((section) => section.id === "earning-rule").body
  const redemption = sections.find(
    (section) => section.id === "redemption"
  ).body
  assert.match(earning, /06:30 Europe\/London/)
  assert.doesNotMatch(earning, /Minimum spend|one transaction per stamp/)
  assert.match(redemption, /No expiry is configured/)
  assert.doesNotMatch(redemption, /56 days|weekday|verified email address/)
})

test("configured windows show exact schedule and upgrade terms without gating ordinary collection", () => {
  const sections = buildVenueTermsSections({
    merchantName: "Venue",
    stampsRequired: 2,
    rewardTerms: "",
    collectionWindows: [
      {
        isodow: 2,
        startsAt: "14:00:00",
        endsAt: "16:30:00",
        upgrade: {
          rewardName: "Wine",
          rewardTerms: "125ml",
          requiresAgeCheck: true,
        },
      },
      { isodow: 7, startsAt: "12:00:00", endsAt: "13:00:00", upgrade: null },
    ],
  })
  const windows = sections.find(
    (section) => section.id === "collection-windows"
  ).body
  assert.match(
    windows,
    /Tuesday 14:00–16:30 Europe\/London\. Upgrade: Wine\. 125ml Photo ID needed/
  )
  assert.match(
    windows,
    /Sunday 12:00–13:00 Europe\/London\. No upgrade configured/
  )
})
