export type DefaultRewardPoolItem = {
  rewardName: string
  rewardTerms: string
  weight: number
  displayOrder: number
  isActive: boolean
}

/** Starter rewards for new mystery visit cards — editable after seeding. */
export const DEFAULT_REWARD_POOL_ITEMS: readonly DefaultRewardPoolItem[] = [
  {
    rewardName: "Free pint of your choice",
    rewardTerms:
      "Choose any pint from our range on the house. Valid from the next UK business day.",
    weight: 1,
    displayOrder: 1,
    isActive: true,
  },
  {
    rewardName: "10% off next visit",
    rewardTerms:
      "Get 10% off your entire bill on your next visit. Valid from the next UK business day.",
    weight: 1,
    displayOrder: 2,
    isActive: true,
  },
  {
    rewardName: "Free dessert of your choice",
    rewardTerms:
      "Choose any dessert from our menu on the house. Valid from the next UK business day.",
    weight: 1,
    displayOrder: 3,
    isActive: true,
  },
] as const
