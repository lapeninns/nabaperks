import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import {
  CUSTOMER_LEGAL_VERSION,
  PLATFORM_TERMS_META,
  PLATFORM_TERMS_SECTIONS,
  buildVenueTermsSections,
} from "@/lib/legal/content"

test("activation version reaches every join acceptance and its snapshot trigger", () => {
  assert.equal(CUSTOMER_LEGAL_VERSION, "2026-09-28")
  assert.match(PLATFORM_TERMS_META.eyebrow, /28 September 2026/)
  assert.equal(PLATFORM_TERMS_META.docNumber, "CT-2026-09-28")
  const action = readFileSync("app/m/[merchantSlug]/join/actions.ts", "utf8")
  assert.match(action, /const policyVersion = CUSTOMER_LEGAL_VERSION/)
  assert.equal(
    (action.match(/p_policy_version: policyVersion/g) ?? []).length,
    3
  )
  const migration = readFileSync(
    "supabase/migrations/20261007100000_loyalty_terms_snapshot_v20260928.sql",
    "utf8"
  )
  assert.ok(
    migration.includes(`new.policy_version <> '${CUSTOMER_LEGAL_VERSION}'`)
  )
  const joining = buildVenueTermsSections({
    merchantName: "Venue",
    stampsRequired: 4,
    rewardTerms: "",
  }).find((section) => section.id === "joining").body
  assert.ok(
    migration.includes(`'body', '${joining}'`),
    "the database snapshot records the joining text the join page shows"
  )
})

test("customer terms describe joining and signing in by phone or email as shipped", () => {
  const joining = PLATFORM_TERMS_SECTIONS.find(
    (section) => section.id === "joining"
  ).body
  for (const rule of [
    /one-time code sent by text message to your mobile number or, where the page offers it, by email/,
    /control that phone number or inbox/,
    /Each phone number and each verified email address can belong to only one Nabaperks wallet/,
    /An email address can start a new wallet only on a venue join page, after you choose to start one/,
    /opens only a wallet that already holds that verified address/,
    /stamps stay on the wallet you first joined with/,
    /does not merge wallets automatically/,
    /a wallet started with an email address can add a mobile number, as long as no other wallet holds it/,
    /public offer link need a confirmed phone number/,
    /select the required loyalty-terms control before a membership is created/,
    /immutable copy of the venue terms accepted/,
  ]) {
    assert.match(joining, rule)
  }
  assert.doesNotMatch(joining, /sent by text\. /)
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
  assert.match(
    body("redemption"),
    /A verified email address is required before reward collection/
  )
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
  assert.doesNotMatch(redemption, /56 days|weekday/)
  assert.match(
    redemption,
    /A verified email address is required before reward collection/
  )
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
