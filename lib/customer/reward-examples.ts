/**
 * Examples of what a venue's mystery draw can land on, for the welcome pitch.
 *
 * The reward itself is drawn by weight when the card completes, so these are
 * never "the" reward: the welcome card rotates through them one per loop and
 * says "Could be…". Active items only, in the venue's display order, capped so
 * a long pool does not turn the loop into a catalogue.
 */
export const MAX_REWARD_EXAMPLES = 6

type PoolItemLike = {
  reward_name: string | null
  is_active: boolean | null
  display_order: number | null
}

export function rewardExamplesFromPool(
  items: readonly PoolItemLike[] | null | undefined
): string[] {
  if (!items) return []

  return items
    .filter((item) => item.is_active === true)
    .map((item, index) => ({
      name: item.reward_name?.trim() ?? "",
      order: item.display_order ?? Number.MAX_SAFE_INTEGER,
      index,
    }))
    .filter((item) => item.name.length > 0)
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((item) => item.name)
    .filter((name, index, all) => all.indexOf(name) === index)
    .slice(0, MAX_REWARD_EXAMPLES)
}

/** The example to show on a given loop cycle, or null when the pool is empty. */
export function rewardExampleForCycle(
  examples: readonly string[] | undefined,
  cycleIndex: number
): string | null {
  if (!examples || examples.length === 0) return null
  const safeIndex = Math.max(0, Math.floor(cycleIndex))
  return examples[safeIndex % examples.length] ?? null
}
