import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"

const ORIGIN = "https://app.nabaperks.test"
const TOKEN = "123e4567-e89b-12d3-a456-426614174000"

test("merchant reward scanner accepts same-origin reward token URLs", () => {
  const cases = [
    [`${ORIGIN}/r/${TOKEN}`, `/app/rewards/scan/${TOKEN}`],
    [`/r/${TOKEN}`, `/app/rewards/scan/${TOKEN}`],
    [`  /r/${TOKEN}  `, `/app/rewards/scan/${TOKEN}`],
    [`${ORIGIN}/r/${TOKEN}?utm=ignored#section`, `/app/rewards/scan/${TOKEN}`],
  ]

  for (const [value, href] of cases) {
    assert.deepEqual(normalizeScannedRewardDestination(value, ORIGIN), {
      kind: "valid",
      href,
    })
  }
})

test("merchant reward scanner rejects non-reward and cross-origin payloads", () => {
  const invalidPayloads = [
    "",
    "not a url",
    "https://evil.example/r/123e4567-e89b-12d3-a456-426614174000",
    `${ORIGIN}/q/old-crown-girton`,
    `${ORIGIN}/r/not-a-uuid`,
    `${ORIGIN}/r/${TOKEN}/extra`,
  ]

  for (const value of invalidPayloads) {
    assert.deepEqual(normalizeScannedRewardDestination(value, ORIGIN), {
      kind: "invalid",
    })
  }
})

test("merchant reward scanner normalization is idempotent for repeated decodes", () => {
  const payload = `${ORIGIN}/r/${TOKEN}`
  const first = normalizeScannedRewardDestination(payload, ORIGIN)
  const second = normalizeScannedRewardDestination(payload, ORIGIN)

  assert.deepEqual(second, first)
})
