import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

describe("contract-merchant-reward-presets source contract", () => {
  it("passes preset catalogues from launch panels into the existing forms", () => {
    const cardPanel = readProjectFile(
      "components/merchant/launch/card-panel.tsx"
    )
    const rewardsPanel = readProjectFile(
      "components/merchant/launch/rewards-panel.tsx"
    )

    assert.match(cardPanel, /CARD_CADENCE_PRESETS/)
    assert.match(cardPanel, /cadencePresets=\{CARD_CADENCE_PRESETS\}/)
    assert.match(rewardsPanel, /rewardPresetsForBusinessType/)
    assert.match(
      rewardsPanel,
      /presets=\{rewardPresetsForBusinessType\(merchant\.business_type\)\}/
    )
  })

  it("keeps card and reward persistence but no auto-seed", () => {
    const cardForm = readProjectFile(
      "components/merchant/loyalty-card-form.tsx"
    )
    const rewardForm = readProjectFile(
      "components/merchant/reward-pool-form.tsx"
    )
    const actions = readProjectFile("app/app/card/actions.ts")

    assert.match(cardForm, /saveLoyaltyCardAction/)
    assert.match(rewardForm, /saveRewardPoolItemAction/)
    assert.match(actions, /save_loyalty_card/)
    assert.match(actions, /upsert_reward_pool_item/)
    // The reward pool is no longer auto-seeded; the merchant adds rewards.
    assert.doesNotMatch(actions, /seedDefaultRewardPool/)
  })

  it("keeps non-pub merchants away from pub-specific copy", () => {
    const form = readProjectFile("components/merchant/reward-pool-form.tsx")
    const presets = readProjectFile("lib/merchant/reward-presets.ts")

    assert.match(form, /Reward ideas/)
    assert.match(presets, /GENERIC_REWARD_PRESETS/)
    assert.match(presets, /businessType === "pub"/)
  })
})
