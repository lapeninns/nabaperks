import assert from "node:assert/strict"
import { test } from "node:test"

import { loadRewardScanLoader } from "../support/reward-scan-loader-harness.mjs"
import { loadScanPage, renderScanPage } from "../support/scan-page-harness.mjs"

// QA BUG-060 (38c42a1..2c45031): a user who is signed in but owns no venue was
// treated as signed out on the reward-scan and pass-scan pages, sent to
// /login, and bounced straight back by /login, forever. Signed out still goes
// to /login with the scan as `next`; signed in without a venue goes to
// onboarding, as /app does, and the token is not carried along.
const TOKEN = "11111111-1111-4111-8111-111111111111"
const ONBOARDING = "/app/onboarding"

test("Given a signed-in user with no venue When a reward scan loads Then the context says no merchant rather than signed out", async () => {
  const mod = await loadRewardScanLoader()
  mod.state.merchant = null

  assert.deepEqual(await mod.loadMerchantRewardScanContext(TOKEN), {
    status: "no_merchant",
  })
  assert.deepEqual(mod.state.calls, [])
})

test("Given no session When a reward scan loads Then the context is unauthenticated", async () => {
  const mod = await loadRewardScanLoader()
  mod.state.user = null

  assert.deepEqual(await mod.loadMerchantRewardScanContext(TOKEN), {
    status: "unauthenticated",
  })
})

const REWARD_PAGE = "app/app/rewards/scan/[scanToken]/page.tsx"
const OFFER_PAGE = "app/app/offers/scan/[passToken]/page.tsx"

test("Given a signed-in user with no venue When the reward-scan page renders Then it redirects to onboarding without the token", async () => {
  const page = await loadScanPage(REWARD_PAGE)
  page.state.impl.loadMerchantRewardScanContext = { status: "no_merchant" }

  assert.deepEqual(
    await renderScanPage(page.default, {
      params: { scanToken: TOKEN },
      key: "scanToken",
    }),
    { redirect: ONBOARDING }
  )
})

test("Given no session When the reward-scan page renders Then it sends the scan to login", async () => {
  const page = await loadScanPage(REWARD_PAGE)
  page.state.impl.loadMerchantRewardScanContext = { status: "unauthenticated" }

  assert.deepEqual(
    await renderScanPage(page.default, {
      params: { scanToken: TOKEN },
      key: "scanToken",
    }),
    {
      redirect: `/login?next=${encodeURIComponent(`/app/rewards/scan/${TOKEN}`)}`,
    }
  )
})

test("Given a signed-in user with no venue When the pass-scan page renders Then it redirects to onboarding without loading the pass", async () => {
  const page = await loadScanPage(OFFER_PAGE)
  page.state.impl.getCurrentMerchant = null
  page.state.impl.getCurrentUser = { id: "colleague-1" }

  assert.deepEqual(
    await renderScanPage(page.default, {
      params: { passToken: TOKEN },
      key: "passToken",
    }),
    { redirect: ONBOARDING }
  )
  assert.equal(
    page.state.calls.includes("loadMerchantOfferPassScanContext"),
    false
  )
})

test("Given no session When the pass-scan page renders Then it sends the pass to login", async () => {
  const page = await loadScanPage(OFFER_PAGE)
  page.state.impl.getCurrentMerchant = null
  page.state.impl.getCurrentUser = null

  assert.deepEqual(
    await renderScanPage(page.default, {
      params: { passToken: TOKEN },
      key: "passToken",
    }),
    {
      redirect: `/login?next=${encodeURIComponent(`/app/offers/scan/${TOKEN}`)}`,
    }
  )
})
