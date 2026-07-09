/**
 * Suggested copy for the optional birthday reward, business-typed like the
 * reward presets. Prefill only: it fills the form when the merchant switches the
 * treat on and is never persisted until they save. en-GB, no emoji, no
 * exclamation marks; the reward name fits the 100-character field limit and the
 * terms sit within the 12–500-character range the save action enforces.
 */
export type BirthdayRewardTemplate = {
  readonly rewardName: string
  readonly rewardTerms: string
}

export const PUB_BIRTHDAY_REWARD: BirthdayRewardTemplate = {
  rewardName: "Birthday drink on us",
  rewardTerms:
    "One drink on us during your birthday month — a pint, a glass of wine, or a soft drink. Valid once issued.",
}

export const CAFE_BIRTHDAY_REWARD: BirthdayRewardTemplate = {
  rewardName: "Birthday coffee and cake",
  rewardTerms:
    "A coffee and a slice of cake on us during your birthday month. Valid once issued.",
}

export const GENERIC_BIRTHDAY_REWARD: BirthdayRewardTemplate = {
  rewardName: "A birthday treat",
  rewardTerms:
    "A little something to mark your birthday month, on us. Valid once issued.",
}

/** Birthday template for a merchant, keyed on their `business_type`. */
export function birthdayRewardTemplateForBusinessType(
  businessType: string | null | undefined
): BirthdayRewardTemplate {
  switch (businessType) {
    case "pub":
      return PUB_BIRTHDAY_REWARD
    case "cafe":
    case "dessert":
    case "bubble_tea":
      return CAFE_BIRTHDAY_REWARD
    default:
      return GENERIC_BIRTHDAY_REWARD
  }
}
