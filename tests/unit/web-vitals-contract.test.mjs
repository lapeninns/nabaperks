import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseWebVitalSample,
  webVitalRouteKey,
} from "@/lib/analytics/web-vitals-contract"

const validSample = {
  metricName: "LCP",
  metricId: "v4-12345-67890",
  value: 2_100,
  delta: 2_100,
  rating: "good",
  routeKey: "home",
  navigationType: "navigate",
}

test("web vital capture accepts only closed, bounded performance data", () => {
  assert.deepEqual(parseWebVitalSample(validSample), validSample)
  assert.equal(
    parseWebVitalSample({ ...validSample, routeKey: "/pricing?email=x" }),
    null
  )
  assert.equal(parseWebVitalSample({ ...validSample, metricName: "FID" }), null)
  assert.equal(
    parseWebVitalSample({ ...validSample, value: Number.POSITIVE_INFINITY }),
    null
  )
  assert.equal(
    parseWebVitalSample({ ...validSample, metricName: "CLS", value: 11 }),
    null
  )
})

test("web vital route mapping never emits a raw or unsupported URL", () => {
  assert.equal(webVitalRouteKey("/"), "home")
  assert.equal(webVitalRouteKey("/pricing/"), "pricing")
  assert.equal(webVitalRouteKey("/signup"), null)
  assert.equal(webVitalRouteKey("/loyalty-for-cafes"), null)
})
