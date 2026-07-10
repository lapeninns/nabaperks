export type RewardPreset = {
  readonly id: string
  readonly rewardName: string
  readonly rewardTerms: string
  readonly description: string
}

export type RewardPoolItemPresetValues = {
  readonly rewardName: string
  readonly rewardTerms: string
  readonly weight: string
  readonly displayOrder: string
  readonly isActive: boolean
}

export type CardCadencePreset = {
  readonly id: string
  readonly label: string
  readonly stampsRequired: number
  readonly description: string
}

export const PUB_REWARD_PRESETS: readonly RewardPreset[] = [
  {
    id: "regulars-pint",
    rewardName: "Regulars' pint",
    rewardTerms:
      "One house pint, small wine, or soft drink for the member. Valid once issued.",
    description: "Good for wet-led regulars.",
  },
  {
    id: "free-starter",
    rewardName: "Free starter",
    rewardTerms:
      "One starter up to GBP 8 with any main meal. Valid once issued.",
    description: "Works for food-led visits.",
  },
  {
    id: "dessert-on-the-house",
    rewardName: "Dessert on the house",
    rewardTerms:
      "One dessert from the main menu with any paid main. Valid once issued.",
    description: "Useful after evening meals.",
  },
  {
    id: "coffee-after-lunch",
    rewardName: "Coffee after lunch",
    rewardTerms:
      "One tea, coffee, or soft drink after a paid lunch. Valid once issued.",
    description: "Fits lunch and daytime trade.",
  },
  {
    id: "kids-meal",
    rewardName: "Kids' meal with adult main",
    rewardTerms:
      "One kids' meal with a paid adult main course. Valid once issued.",
    description: "A family-table reward.",
  },
  {
    id: "sunday-roast-upgrade",
    rewardName: "Sunday roast upgrade",
    rewardTerms:
      "One roast upgrade or extra side with a Sunday main. Valid once issued.",
    description: "A Sunday-led nudge.",
  },
  {
    id: "ten-percent-off",
    rewardName: "10% off the next bill",
    rewardTerms:
      "Ten percent off food on one visit, excluding drinks. Valid once issued.",
    description: "Simple, familiar value.",
  },
]

export const GENERIC_REWARD_PRESETS: readonly RewardPreset[] = [
  {
    id: "free-item",
    rewardName: "Free item",
    rewardTerms:
      "One eligible item from the standard menu or service list. Valid once issued.",
    description: "A simple reward any local business can tune.",
  },
  {
    id: "member-upgrade",
    rewardName: "Member upgrade",
    rewardTerms:
      "One complimentary upgrade on an eligible purchase. Valid once issued.",
    description: "Good when an upsell has low fulfilment risk.",
  },
  {
    id: "ten-percent-off",
    rewardName: "10% off",
    rewardTerms:
      "Ten percent off one eligible purchase, excluding gift cards and third-party fees. Valid once issued.",
    description: "Familiar value without naming a venue type.",
  },
  {
    id: "member-perk",
    rewardName: "Member perk",
    rewardTerms:
      "One member-only perk chosen by the business team. Valid once issued.",
    description: "A flexible placeholder for teams still deciding.",
  },
]

export const CARD_CADENCE_PRESETS: readonly CardCadencePreset[] = [
  {
    id: "lunch-trade",
    label: "Lunch-trade card",
    stampsRequired: 3,
    description: "Pick 3 for quick daytime repeat visits.",
  },
  {
    id: "food-led",
    label: "Food-led card",
    stampsRequired: 5,
    description: "Works for meals and planned visits.",
  },
  {
    id: "wet-led",
    label: "Wet-led card",
    stampsRequired: 6,
    description: "Pick 6 so a weekly regular unlocks roughly monthly.",
  },
]

export const MAX_REWARD_PRESET_BATCH = 7
const INVALID_REWARD_PRESET_SELECTION = "Invalid reward preset selection."
const DEFINITE_REWARD_PRESET_ROLLBACK_CODES = new Set([
  "22023",
  "40001",
  "40002",
  "40P01",
  "42501",
  "P0001",
])

export function rewardPresetsForBusinessType(
  businessType: string | null | undefined
): readonly RewardPreset[] {
  return businessType === "pub" ? PUB_REWARD_PRESETS : GENERIC_REWARD_PRESETS
}

/** Stable key shared by preset selection and the database idempotency boundary. */
export function rewardNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * A separately saved reward becomes authoritative immediately. Remove any
 * selected preset with the same normalized name so the draft tray cannot
 * submit or count a reward that the pool now already contains.
 */
export function reconcileSelectedPresetIdsAfterRewardSave(
  presets: readonly RewardPreset[],
  selectedPresetIds: readonly string[],
  savedRewardName: string
): string[] {
  const savedNameKey = rewardNameKey(savedRewardName)
  const matchingPresetIds = new Set(
    presets
      .filter((preset) => rewardNameKey(preset.rewardName) === savedNameKey)
      .map((preset) => preset.id)
  )

  return selectedPresetIds.filter((id) => !matchingPresetIds.has(id))
}

/**
 * Only codes that prove PostgreSQL rejected/rolled back the RPC may support
 * absolute no-change copy. Connection and completion-unknown codes stay out.
 */
export function isDefiniteRewardPresetRollbackCode(
  code: string | null | undefined
): boolean {
  return (
    typeof code === "string" &&
    (DEFINITE_REWARD_PRESET_ROLLBACK_CODES.has(code) ||
      /^23[0-9A-Z]{3}$/.test(code))
  )
}

/**
 * Resolve untrusted posted ids against the merchant's server-owned catalogue.
 * The catalogue — not click order — owns persistence order, and one bad id
 * rejects the whole selection before the action reaches PostgreSQL.
 */
export function resolveRewardPresetsByIds(
  businessType: string | null | undefined,
  ids: readonly string[]
): readonly RewardPreset[] {
  if (ids.length < 1) {
    throw new Error(INVALID_REWARD_PRESET_SELECTION)
  }

  const requestedIds = new Set<string>()
  for (const rawId of ids) {
    const id = rawId.trim()
    if (!id) throw new Error(INVALID_REWARD_PRESET_SELECTION)
    requestedIds.add(id)
  }

  if (
    requestedIds.size < 1 ||
    requestedIds.size > MAX_REWARD_PRESET_BATCH
  ) {
    throw new Error(INVALID_REWARD_PRESET_SELECTION)
  }

  const resolved = rewardPresetsForBusinessType(businessType).filter((preset) =>
    requestedIds.has(preset.id)
  )

  if (resolved.length !== requestedIds.size) {
    throw new Error(INVALID_REWARD_PRESET_SELECTION)
  }

  return resolved
}

export function rewardPresetToPoolItemValues(
  preset: RewardPreset,
  displayOrder: number
): RewardPoolItemPresetValues {
  return {
    rewardName: preset.rewardName,
    rewardTerms: preset.rewardTerms,
    weight: "1",
    displayOrder: String(displayOrder),
    isActive: true,
  }
}
