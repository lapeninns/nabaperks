import assert from "node:assert/strict"
import { test } from "node:test"

import { isIncidentalAbortedPrefetch } from "../e2e/helpers/aborted-rsc-request.ts"

// Messages recorded by the failed production release proofs (runs 36356000291
// and 36415944518) on mobile-safari.
const RECORDED = [
  "/127.0.0.1:3001/app?_rsc=oKIvww_lkiZlKHdA due to access control checks.",
  "/127.0.0.1:3001/app/activity?_rsc=0dM73Xcmr31ImGre due to access control checks.",
  "/127.0.0.1:3001/app/numbers?_rsc=0dM73Xcmr31ImGre due to access control checks.",
  "Fetch API cannot load https://127.0.0.1:3001/app?_rsc=0dM73Xcmr31ImGre due to access control checks.",
]

test("ignores WebKit's cancelled background prefetches of merchant console links", () => {
  for (const message of RECORDED) {
    assert.equal(isIncidentalAbortedPrefetch(message, "webkit"), true, message)
  }
})

test("never ignores the same wording from another browser", () => {
  for (const browser of ["chromium", "firefox"]) {
    for (const message of RECORDED) {
      assert.equal(isIncidentalAbortedPrefetch(message, browser), false)
    }
  }
})

test("still fails the journey for pages it actually opens or other errors", () => {
  const mustFail = [
    "/127.0.0.1:3001/reward/abc?_rsc=0dM73Xcmr31ImGre due to access control checks.",
    "/127.0.0.1:3001/app/rewards/scan/xyz?_rsc=0dM73Xcmr31ImGre due to access control checks.",
    "/127.0.0.1:3001/app/activity/extra?_rsc=0dM73Xcmr31ImGre due to access control checks.",
    "Fetch API cannot load http://127.0.0.1:3001/api/x due to access control checks.",
    "/127.0.0.1:3001/app?_rsc=0dM73Xcmr31ImGre failed to load",
    "TypeError: undefined is not an object",
  ]
  for (const message of mustFail) {
    assert.equal(isIncidentalAbortedPrefetch(message, "webkit"), false, message)
  }
})
