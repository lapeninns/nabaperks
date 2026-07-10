import assert from "node:assert/strict"
import { test } from "node:test"

const contractLoad =
  await import("@/lib/analytics/merchant-activation-contract").then(
    (contract) => ({ contract, error: null }),
    (error) => ({ contract: null, error })
  )

test("the merchant activation presentation contract is importable", () => {
  assert.ok(
    contractLoad.contract,
    `expected lib/analytics/merchant-activation-contract.ts to exist and load: ${contractLoad.error?.message ?? "unknown import error"}`
  )
})

const requiresContract = contractLoad.contract
  ? {}
  : { skip: "merchant activation contract is the next Green implementation" }

const aggregateRow = {
  account_created: "1204",
  email_verified: "1188",
  onboarding_complete: "1120",
  launch_entered: "1095",
  venue_ready: "1040",
  card_ready: "995",
  rewards_ready: "910",
  qr_ready: "860",
  poster_ready: "780",
  billing_reached: "720",
  billing_activated: "650",
  first_customer_stamped: "503",
  first_stamp_7d_yes: "401",
  first_stamp_7d_no: "44",
  first_stamp_7d_pending: "205",
  median_signup_to_poster_seconds: "5400",
}

const parsedAggregate = {
  account_created: 1204,
  email_verified: 1188,
  onboarding_complete: 1120,
  launch_entered: 1095,
  venue_ready: 1040,
  card_ready: 995,
  rewards_ready: 910,
  qr_ready: 860,
  poster_ready: 780,
  billing_reached: 720,
  billing_activated: 650,
  first_customer_stamped: 503,
  first_stamp_7d_yes: 401,
  first_stamp_7d_no: 44,
  first_stamp_7d_pending: 205,
  median_signup_to_poster_seconds: 5400,
}

test(
  "the activation funnel keeps the agreed account-to-first-stamp stage order",
  requiresContract,
  () => {
    const { MERCHANT_ACTIVATION_STAGES } = contractLoad.contract

    assert.deepEqual(
      MERCHANT_ACTIVATION_STAGES.map((stage) => stage.key),
      [
        "account_created",
        "email_verified",
        "onboarding_complete",
        "launch_entered",
        "venue_ready",
        "card_ready",
        "rewards_ready",
        "qr_ready",
        "poster_ready",
        "billing_reached",
        "billing_activated",
        "first_customer_stamped",
      ]
    )
    assert.deepEqual(
      MERCHANT_ACTIVATION_STAGES.map((stage) => stage.label),
      [
        "Account created",
        "Email verified",
        "Onboarding complete",
        "Launch setup entered",
        "Venue ready",
        "Card ready",
        "Three rewards live",
        "Venue QR ready",
        "Poster ready",
        "Billing reached",
        "Billing activated",
        "First customer stamped",
      ]
    )
  }
)

test(
  "the aggregate parser accepts exactly one PostgREST row and normalises numeric counts",
  requiresContract,
  () => {
    const { parseMerchantActivationCohortFacts } = contractLoad.contract

    assert.deepEqual(
      parseMerchantActivationCohortFacts([aggregateRow]),
      parsedAggregate
    )
    assert.deepEqual(
      parseMerchantActivationCohortFacts([
        { ...aggregateRow, median_signup_to_poster_seconds: null },
      ]),
      { ...parsedAggregate, median_signup_to_poster_seconds: null }
    )
  }
)

test(
  "the aggregate parser rejects malformed cardinality, counts, and identifier-bearing rows",
  requiresContract,
  () => {
    const { parseMerchantActivationCohortFacts } = contractLoad.contract

    for (const invalid of [
      null,
      aggregateRow,
      [],
      [aggregateRow, aggregateRow],
      [{ ...aggregateRow, account_created: "1.5" }],
      [{ ...aggregateRow, rewards_ready: -1 }],
      [{ ...aggregateRow, poster_ready: Number.POSITIVE_INFINITY }],
      [{ ...aggregateRow, median_signup_to_poster_seconds: "not-a-number" }],
      [
        {
          ...aggregateRow,
          owner_user_id: "00000000-0000-0000-0000-000000000001",
        },
      ],
      [{ ...aggregateRow, funnel_key: "a".repeat(64) }],
      [
        {
          ...aggregateRow,
          merchant_id: "00000000-0000-0000-0000-000000000002",
        },
      ],
    ]) {
      assert.throws(
        () => parseMerchantActivationCohortFacts(invalid),
        /invalid merchant activation cohort facts/i
      )
    }
  }
)

test(
  "the parsed presentation model contains aggregate facts only",
  requiresContract,
  () => {
    const { parseMerchantActivationCohortFacts } = contractLoad.contract
    const facts = parseMerchantActivationCohortFacts([aggregateRow])

    assert.deepEqual(Object.keys(facts), Object.keys(parsedAggregate))
    assert.ok(
      Object.values(facts).every(
        (value) => value === null || typeof value === "number"
      ),
      "aggregate facts contain numbers only, never identity values"
    )
    assert.doesNotMatch(
      JSON.stringify(Object.values(facts)),
      /[0-9a-f]{8}-[0-9a-f-]{27,}/i
    )
  }
)

test(
  "the default activation cohort is the trailing 30 days with a fixed as-of instant",
  requiresContract,
  () => {
    const {
      MERCHANT_ACTIVATION_COHORT_DAYS,
      buildMerchantActivationCohortWindow,
    } = contractLoad.contract
    const asOf = new Date("2026-07-10T12:34:56.000Z")

    assert.equal(MERCHANT_ACTIVATION_COHORT_DAYS, 30)
    assert.deepEqual(buildMerchantActivationCohortWindow(asOf), {
      cohortStart: "2026-06-10T12:34:56.000Z",
      cohortEnd: "2026-07-10T12:34:56.000Z",
      asOf: "2026-07-10T12:34:56.000Z",
    })
    assert.throws(
      () => buildMerchantActivationCohortWindow(new Date("invalid")),
      /invalid.*date|invalid.*as-of/i
    )
  }
)

test(
  "median signup-to-poster time is calm readable copy and never leaks raw rows",
  requiresContract,
  () => {
    const { formatMedianSignupToPoster } = contractLoad.contract

    assert.equal(formatMedianSignupToPoster(null), "Not available yet")
    assert.equal(formatMedianSignupToPoster(0), "Under 1 min")
    assert.equal(formatMedianSignupToPoster(60), "1 min")
    assert.equal(formatMedianSignupToPoster(5_400), "1 hr 30 mins")
  }
)

test(
  "funnel chart items use the fixed stage order and aggregate values only",
  requiresContract,
  () => {
    const { MERCHANT_ACTIVATION_STAGES, toMerchantActivationFunnelItems } =
      contractLoad.contract
    const items = toMerchantActivationFunnelItems(parsedAggregate)

    assert.deepEqual(
      items,
      MERCHANT_ACTIVATION_STAGES.map(({ key, label }) => ({
        label,
        value: parsedAggregate[key],
      }))
    )
    assert.deepEqual(Object.keys(items[0]), ["label", "value"])
  }
)
