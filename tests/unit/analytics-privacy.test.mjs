import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildExternalAnalyticsProperties,
  buildPostHogCapturePayload,
  pseudonymizeAnalyticsId,
  resolvePostHogConfig,
} from "@/lib/analytics/privacy-core"
import {
  deterministicFunnelEventId,
  issueFunnelToken,
  verifyFunnelToken,
} from "@/lib/analytics/funnel-token"

/**
 * analytics funnel identity privacy — pure privacy and funnel-identity
 * boundaries. All clocks and secrets are explicit so this proof is stable and
 * never depends on a developer's analytics environment.
 */

const RAW_MERCHANT_ID = "f45e6d0a-4b3d-4fc6-99f0-7d91a1092df4"
const FUNNEL_ID = "8e2b4e4c-17dc-4f90-a7d1-c19035acd917"
const PSEUDONYM_SECRET = "unit-test-analytics-pseudonym-secret"
const FUNNEL_SECRET = "unit-test-funnel-signing-secret"
const NOW_MS = Date.parse("2026-07-10T12:00:00.000Z")
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000

const COMPLETE_POSTHOG_ENV = {
  ANALYTICS_EXTERNAL_PROCESSING_MODE: "pseudonymous",
  POSTHOG_PROJECT_KEY: "phc_unit_test",
  POSTHOG_HOST: "https://eu.i.posthog.com",
  ANALYTICS_PSEUDONYM_SECRET: PSEUDONYM_SECRET,
}

test("PostHog stays disabled unless pseudonymous mode and every server-only setting are present", () => {
  const disabledEnvironments = [
    {},
    {
      ...COMPLETE_POSTHOG_ENV,
      ANALYTICS_EXTERNAL_PROCESSING_MODE: undefined,
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      ANALYTICS_EXTERNAL_PROCESSING_MODE: "PSEUDONYMOUS",
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      ANALYTICS_EXTERNAL_PROCESSING_MODE: " pseudonymous",
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      POSTHOG_PROJECT_KEY: undefined,
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      POSTHOG_HOST: undefined,
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      ANALYTICS_PSEUDONYM_SECRET: undefined,
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      POSTHOG_PROJECT_KEY: "project_without_phc_prefix",
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      ANALYTICS_PSEUDONYM_SECRET: "only-sixteen-ish",
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      POSTHOG_HOST: "http://analytics.example.com",
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      POSTHOG_HOST: "https://eu.i.posthog.com/capture",
    },
    {
      ...COMPLETE_POSTHOG_ENV,
      POSTHOG_HOST: "https://user:pass@eu.i.posthog.com",
    },
    {
      ANALYTICS_EXTERNAL_PROCESSING_MODE: "pseudonymous",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_legacy_public_key",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      ANALYTICS_PSEUDONYM_SECRET: PSEUDONYM_SECRET,
    },
  ]

  for (const environment of disabledEnvironments) {
    assert.equal(
      resolvePostHogConfig(environment),
      null,
      `expected disabled config for ${JSON.stringify(environment)}`
    )
  }

  const enabled = resolvePostHogConfig(COMPLETE_POSTHOG_ENV)
  assert.ok(enabled, "complete pseudonymous configuration enables capture")
  assert.equal(enabled.projectKey, COMPLETE_POSTHOG_ENV.POSTHOG_PROJECT_KEY)
  assert.equal(enabled.host, COMPLETE_POSTHOG_ENV.POSTHOG_HOST)
  assert.equal(enabled.pseudonymSecret, PSEUDONYM_SECRET)
})

test("analytics pseudonyms are stable, domain-separated, and contain no raw identifier", () => {
  const merchantOne = pseudonymizeAnalyticsId(
    "merchant",
    RAW_MERCHANT_ID,
    PSEUDONYM_SECRET
  )
  const merchantTwo = pseudonymizeAnalyticsId(
    "merchant",
    RAW_MERCHANT_ID,
    PSEUDONYM_SECRET
  )
  const customer = pseudonymizeAnalyticsId(
    "customer",
    RAW_MERCHANT_ID,
    PSEUDONYM_SECRET
  )

  assert.equal(merchantOne, merchantTwo, "the same domain and value are stable")
  assert.notEqual(
    merchantOne,
    customer,
    "the same UUID in different identity domains cannot be correlated"
  )
  assert.doesNotMatch(merchantOne, new RegExp(RAW_MERCHANT_ID, "i"))
  assert.doesNotMatch(merchantOne, /f45e6d0a|7d91a1092df4/i)
})

test("only allowlisted bounded scalar properties can leave first-party analytics", () => {
  const safeProperties = {
    source: "homepage",
    step: "email_verification",
    surface: "merchant_signup",
    tab: "billing",
    billing_interval: "annual",
    outcome: "success",
    entitlement_status: "active",
    actor_type: "merchant",
  }

  assert.deepEqual(
    buildExternalAnalyticsProperties(safeProperties),
    safeProperties
  )
  assert.equal(
    buildExternalAnalyticsProperties({
      ...safeProperties,
      source: "x".repeat(129),
    }),
    null,
    "allowlisted strings still have a hard size bound"
  )
})

test("outbound analytics rejects nested personal data, identifiers, URLs, tokens, arrays, and unknown keys", async (t) => {
  const unsafeCases = [
    ["nested email", { source: { contact: "landlord@example.com" } }],
    ["nested phone", { source: { contact: "+44 7700 900123" } }],
    ["raw UUID", { source: RAW_MERCHANT_ID }],
    ["IP address", { source: "203.0.113.42" }],
    ["URL", { source: "https://nabaperks.com/signup?email=owner@example.com" }],
    ["token key", { token: "eyJhbGciOiJIUzI1NiJ9.payload.signature" }],
    ["secret key", { api_secret: "sk_live_not-for-analytics" }],
    ["provider identifier", { stripe_subscription_id: "sub_123456789" }],
    ["identifier-shaped unknown key", { merchantId: RAW_MERCHANT_ID }],
    ["array", { source: ["homepage"] }],
    ["unknown key", { campaign_name: "summer_launch" }],
    ["numeric coordinate in categorical key", { source: 51.5074 }],
    ["unapproved slug-shaped value", { source: "john_smith" }],
    ["inherited object key", { constructor: "homepage" }],
  ]

  for (const [name, properties] of unsafeCases) {
    await t.test(name, () => {
      assert.equal(buildExternalAnalyticsProperties(properties), null)
    })
  }
})

test("external property allowlist rejects Object.prototype key collisions", () => {
  const properties = Object.create(null)
  Object.defineProperty(properties, "toString", {
    configurable: true,
    enumerable: true,
    value: "homepage",
    writable: true,
  })

  assert.equal(
    buildExternalAnalyticsProperties(properties),
    null,
    "a key inherited only by the allowlist object must never be treated as allowlisted"
  )
})

test("a signed funnel token verifies only before its fixed two-hour expiry", () => {
  const token = issueFunnelToken(FUNNEL_ID, FUNNEL_SECRET, NOW_MS)

  const verified = verifyFunnelToken(
    token,
    FUNNEL_SECRET,
    NOW_MS + TWO_HOURS_MS - 1
  )
  assert.ok(verified, "a token is accepted immediately before expiry")
  assert.equal(verified.funnelId, FUNNEL_ID)
  assert.equal(verified.issuedAt, NOW_MS)
  assert.equal(verified.expiresAt, NOW_MS + TWO_HOURS_MS)

  assert.equal(
    verifyFunnelToken(token, FUNNEL_SECRET, NOW_MS + TWO_HOURS_MS),
    null,
    "the token is rejected at the expiry boundary"
  )
})

test("a funnel token rejects tampering and malformed input", () => {
  const token = issueFunnelToken(FUNNEL_ID, FUNNEL_SECRET, NOW_MS)
  const finalCharacter = token.at(-1)
  const tampered = `${token.slice(0, -1)}${finalCharacter === "a" ? "b" : "a"}`

  assert.equal(verifyFunnelToken(tampered, FUNNEL_SECRET, NOW_MS), null)
  assert.equal(
    verifyFunnelToken("not-a-signed-token", FUNNEL_SECRET, NOW_MS),
    null
  )
})

test("first-party event UUIDs are deterministic per token and semantic milestone", () => {
  const token = issueFunnelToken(FUNNEL_ID, FUNNEL_SECRET, NOW_MS)
  const marketingViewOne = deterministicFunnelEventId(
    token,
    "merchant_marketing_viewed"
  )
  const marketingViewTwo = deterministicFunnelEventId(
    token,
    "merchant_marketing_viewed"
  )
  const signupClick = deterministicFunnelEventId(
    token,
    "merchant_signup_clicked"
  )

  assert.match(
    marketingViewOne,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "the durable event key is a database-compatible UUID"
  )
  assert.equal(marketingViewOne, marketingViewTwo)
  assert.notEqual(
    marketingViewOne,
    signupClick,
    "different semantic milestones cannot collapse into one event"
  )
})

test("external capture payload contains only a pseudonym and profileless allowlisted properties", () => {
  const config = resolvePostHogConfig(COMPLETE_POSTHOG_ENV)
  assert.ok(config)

  const payload = buildPostHogCapturePayload(
    {
      eventId: "c692c419-ae48-50fd-ae79-ccfbbed2f532",
      eventName: "merchant_signup_started",
      identityDomain: "merchant",
      identityValue: RAW_MERCHANT_ID,
      properties: { actor_type: "merchant", source: "homepage" },
    },
    config
  )
  assert.ok(payload)
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(RAW_MERCHANT_ID, "i"))
  assert.doesNotMatch(
    JSON.stringify(payload),
    /merchant_id|customer_id|qr_code_id/
  )
  assert.match(payload.distinct_id, /^ana_v1_/)
  assert.deepEqual(payload.properties, {
    actor_type: "merchant",
    source: "homepage",
    $insert_id: pseudonymizeAnalyticsId(
      "event",
      "c692c419-ae48-50fd-ae79-ccfbbed2f532",
      PSEUDONYM_SECRET
    ),
    $process_person_profile: false,
  })

  assert.equal(
    buildPostHogCapturePayload(
      {
        eventName: "merchant_signup_started",
        identityDomain: "merchant",
        identityValue: RAW_MERCHANT_ID,
        properties: { source: { email: "landlord@example.com" } },
      },
      config
    ),
    null,
    "unsafe nested metadata suppresses the entire external event"
  )
})
