/** Legacy full cards must collect their reward before earning more stamps. */
export function legacyRewardBlocksStamps(facts: {
  readonly reward: { readonly status: string } | null
  readonly currentStampCount: number
  readonly stampsRequired: number
}): boolean {
  return (
    facts.reward?.status === "unlocked" &&
    facts.currentStampCount >= facts.stampsRequired
  )
}
