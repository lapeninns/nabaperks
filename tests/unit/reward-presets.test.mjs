import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CARD_CADENCE_PRESETS,
  GENERIC_REWARD_PRESETS,
  isDefiniteRewardPresetRollbackCode,
  PUB_REWARD_PRESETS,
  reconcileSelectedPresetIdsAfterRewardSave,
  resolveRewardPresetsByIds,
  rewardNameKey,
  rewardPresetsForBusinessType,
  rewardPresetToPoolItemValues,
} from "@/lib/merchant/reward-presets"
import {
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
} from "@/lib/merchant/customer-readback"

describe("merchant reward presets", () => {
  it("keeps every pub reward preset inside server action bounds", () => {
    assert.equal(PUB_REWARD_PRESETS.length, 7)
    assertRewardPresetsValid(PUB_REWARD_PRESETS)
  })

  it("keeps every generic reward preset inside server action bounds", () => {
    assert.equal(GENERIC_REWARD_PRESETS.length, 4)
    assertRewardPresetsValid(GENERIC_REWARD_PRESETS)
  })

  it("selects pub presets only for pub merchants", () => {
    assert.equal(rewardPresetsForBusinessType("pub"), PUB_REWARD_PRESETS)
    assert.equal(rewardPresetsForBusinessType("cafe"), GENERIC_REWARD_PRESETS)
    assert.equal(rewardPresetsForBusinessType(null), GENERIC_REWARD_PRESETS)
  })

  it("normalizes reward names for idempotent preset matching", () => {
    assert.equal(rewardNameKey("  FREE\t starter\n"), "free starter")
    assert.equal(
      rewardNameKey("Regulars’   PINT"),
      "regulars’ pint",
      "punctuation is preserved while case and whitespace are normalized"
    )
  })

  it("removes a selected preset when a separate save makes its normalized name authoritative", () => {
    assert.deepEqual(
      reconcileSelectedPresetIdsAfterRewardSave(
        PUB_REWARD_PRESETS,
        ["regulars-pint", "free-starter", "unknown-future-id"],
        "  FREE\tstarter\n"
      ),
      ["regulars-pint", "unknown-future-id"]
    )

    assert.deepEqual(
      reconcileSelectedPresetIdsAfterRewardSave(
        PUB_REWARD_PRESETS,
        ["regulars-pint"],
        "Free starter"
      ),
      ["regulars-pint"],
      "an unrelated authoritative reward must not disturb the draft selection"
    )
  })

  it("uses absolute rollback copy only for definite PostgreSQL failures", () => {
    for (const code of [
      "22023",
      "23505",
      "23514",
      "40001",
      "40002",
      "40P01",
      "42501",
      "P0001",
    ]) {
      assert.equal(isDefiniteRewardPresetRollbackCode(code), true, code)
    }

    for (const code of [
      undefined,
      null,
      "",
      "08007",
      "40003",
      "FETCH",
      "PGRST301",
    ]) {
      assert.equal(isDefiniteRewardPresetRollbackCode(code), false, String(code))
    }
  })

  it("resolves trimmed repeated preset ids once in catalogue order", () => {
    const resolved = resolveRewardPresetsByIds("pub", [
      " dessert-on-the-house ",
      "regulars-pint",
      "dessert-on-the-house",
      " free-starter ",
    ])

    assert.deepEqual(
      resolved.map((preset) => preset.id),
      ["regulars-pint", "free-starter", "dessert-on-the-house"]
    )

    assert.deepEqual(
      resolveRewardPresetsByIds("pub", Array(8).fill(" free-starter ")).map(
        (preset) => preset.id
      ),
      ["free-starter"],
      "the catalogue limit applies after valid repeated ids are deduplicated"
    )
  })

  it("rejects the whole selection when an id is blank, unknown, or from another catalogue", () => {
    for (const ids of [[], [""], ["regulars-pint", "not-a-real-preset"]]) {
      assert.throws(
        () => resolveRewardPresetsByIds("pub", ids),
        { message: "Invalid reward preset selection." },
        `selection ${JSON.stringify(ids)} must be rejected before persistence`
      )
    }

    assert.throws(
      () => resolveRewardPresetsByIds("cafe", ["free-starter"]),
      { message: "Invalid reward preset selection." },
      "a pub-only preset cannot cross the merchant catalogue boundary"
    )
  })

  function assertRewardPresetsValid(presets) {
    for (const preset of presets) {
      assert.ok(preset.rewardName.length > 0)
      assert.ok(preset.rewardName.length <= 100)
      assert.ok(preset.rewardTerms.length >= 12)
      assert.ok(preset.rewardTerms.length <= 500)
      assert.ok(preset.rewardTerms.endsWith("Valid once issued."))
      assert.doesNotMatch(preset.rewardName, /https?:\/\//)
      assert.doesNotMatch(preset.rewardTerms, /https?:\/\/|!/)
    }
  }

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
