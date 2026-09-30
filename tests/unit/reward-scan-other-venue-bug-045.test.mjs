import assert from "node:assert/strict"
import { test } from "node:test"

import { loadRewardScanLoader } from "../support/reward-scan-loader-harness.mjs"
import {
  loadScanPage,
  renderScanPage,
  treeText,
} from "../support/scan-page-harness.mjs"

// QA BUG-045 (38c42a1..2c45031): the owner of another venue opening a reward
// code was told the code had "gone cold" and may have been collected. The
// database now marks that refusal with a hint; the loader must turn exactly
// that refusal into "unauthorized" so the page says the reward belongs to
// another venue, and keep every other refusal (a code that does not exist)
// on the not-found screen.
const SCAN_TOKEN = "11111111-1111-4111-8111-111111111111"
const REFUSED = "Reward not available to this merchant"

async function contextFor(error) {
  const mod = await loadRewardScanLoader()
  mod.state.responses.get_owner_reward_scan_context = { data: null, error }
  return mod.loadMerchantRewardScanContext(SCAN_TOKEN)
}

test("Given another venue's reward code When its scan loads Then the context is unauthorized", async () => {
  assert.deepEqual(
    await contextFor({
      code: "42501",
      message: REFUSED,
      hint: "reward_scan_other_merchant",
      details: null,
    }),
    { status: "unauthorized" }
  )
})

for (const [label, error] of [
  [
    "a code that does not exist",
    { code: "42501", message: REFUSED, hint: null },
  ],
  [
    "the hint on another refusal",
    {
      code: "42501",
      message: "Merchant owner access required",
      hint: "reward_scan_other_merchant",
    },
  ],
]) {
  test(`Given ${label} When its scan loads Then it stays not found`, async () => {
    assert.deepEqual(await contextFor(error), { status: "not_found" })
  })
}

test("Given the hint with another error code When the scan loads Then it is still a failure", async () => {
  await assert.rejects(
    contextFor({
      code: "XX000",
      message: REFUSED,
      hint: "reward_scan_other_merchant",
    }),
    /Unable to load reward scan context/
  )
})

test("Given an unauthorized context When the scan page renders Then staff are told it belongs to another venue", async () => {
  const page = await loadScanPage("app/app/rewards/scan/[scanToken]/page.tsx")
  page.state.impl.loadMerchantRewardScanContext = { status: "unauthorized" }

  const outcome = await renderScanPage(page.default, {
    params: { scanToken: SCAN_TOKEN },
    key: "scanToken",
  })

  assert.ok(outcome.tree, JSON.stringify(outcome))
  const text = treeText(outcome.tree)
  assert.match(text, /Reward not matched/)
  assert.match(text, /This reward belongs to another venue\./)
  assert.doesNotMatch(text, /collected|gone cold/i)
})
