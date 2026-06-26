/** Rotates on each hero card loop after the mystery seal breaks. */
export const HERO_SAMPLE_REWARDS = [
  "A pint on the house",
  "A glass of wine on the house",
  "A flat white on the house",
  "Dessert on the house",
  "A free starter",
  "A hot drink on the house",
] as const

export function heroSampleReward(cycleIndex: number) {
  const pool = HERO_SAMPLE_REWARDS
  const index = ((cycleIndex % pool.length) + pool.length) % pool.length
  return pool[index]
}
