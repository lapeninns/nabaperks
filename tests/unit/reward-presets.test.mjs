import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CARD_CADENCE_PRESETS,
  PUB_REWARD_PRESETS,
  rewardPresetToPoolItemValues,
} from "@/lib/merchant/reward-presets"
import {
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
} from "@/lib/merchant/customer-readback"

describe("merchant reward presets", () => {
  it("keeps every pub reward preset inside server action bounds", () => {
    assert.equal(PUB_REWARD_PRESETS.length, 7)

    for (const preset of PUB_REWARD_PRESETS) {
      assert.ok(preset.rewardName.length > 0)
      assert.ok(preset.rewardName.length <= 100)
      assert.ok(preset.rewardTerms.length >= 12)
      assert.ok(preset.rewardTerms.length <= 500)
      assert.ok(
        preset.rewardTerms.endsWith("Valid from the next UK business day.")
      )
      assert.doesNotMatch(preset.rewardName, /https?:\/\//)
      assert.doesNotMatch(preset.rewardTerms, /https?:\/\/|!/)
    }
  })

  it("converts a preset into existing reward pool form values", () => {
    const values = rewardPresetToPoolItemValues(PUB_REWARD_PRESETS[0], 4)

    assert.deepEqual(values, {
      rewardName: PUB_REWARD_PRESETS[0].rewardName,
      rewardTerms: PUB_REWARD_PRESETS[0].rewardTerms,
      weight: "1",
      displayOrder: "4",
      isActive: true,
    })
  })

  it("keeps cadence presets inside the current card range", () => {
    assert.deepEqual(
      CARD_CADENCE_PRESETS.map((preset) => preset.stampsRequired),
      [3, 5, 6]
    )

    for (const preset of CARD_CADENCE_PRESETS) {
      assert.ok(preset.stampsRequired >= MIN_STAMPS_REQUIRED)
      assert.ok(preset.stampsRequired <= MAX_STAMPS_REQUIRED)
      assert.doesNotMatch(preset.description, /!/)
    }
  })
})
