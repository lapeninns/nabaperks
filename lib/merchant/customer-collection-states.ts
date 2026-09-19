import {
  parseRewardCollectionState,
  type RewardCollectionState,
} from "@/lib/customer/reward-collection-state"

export const MAX_MERCHANT_REWARD_STATE_BATCH = 256

export type MerchantUnlockedRewardRef = {
  readonly id: string
  readonly membership_id: string
}

export type MerchantUnlockedRewardWithCollectionState =
  MerchantUnlockedRewardRef & {
    readonly collection_state: RewardCollectionState
  }

type BatchResult = {
  readonly data: unknown
  readonly error: { readonly message: string } | null
}

type BatchRpc = (args: {
  readonly p_reward_ids: readonly string[]
}) => Promise<BatchResult>

/**
 * Load canonical collection states in bounded sequential service RPCs after the
 * caller selects reward ids through its authenticated, merchant-scoped query.
 */
export async function loadMerchantRewardCollectionStates(
  rewards: readonly MerchantUnlockedRewardRef[],
  rpc: BatchRpc
): Promise<MerchantUnlockedRewardWithCollectionState[]> {
  if (!rewards.length) return []

  const rewardIds = [...new Set(rewards.map((reward) => reward.id))]
  const stateByRewardId = new Map<string, RewardCollectionState>()

  for (
    let offset = 0;
    offset < rewardIds.length;
    offset += MAX_MERCHANT_REWARD_STATE_BATCH
  ) {
    const chunk = rewardIds.slice(
      offset,
      offset + MAX_MERCHANT_REWARD_STATE_BATCH
    )
    const { data, error } = await rpc({ p_reward_ids: chunk })
    if (error) {
      throw new Error(`Unable to load customer reward status: ${error.message}`)
    }
    if (!Array.isArray(data)) throw malformedBatch()

    const expectedIds = new Set(chunk)
    const chunkIds = new Set<string>()
    for (const value of data) {
      if (!isRecord(value) || typeof value.reward_id !== "string") {
        throw malformedBatch()
      }
      if (
        !expectedIds.has(value.reward_id) ||
        chunkIds.has(value.reward_id) ||
        stateByRewardId.has(value.reward_id)
      ) {
        throw malformedBatch()
      }
      chunkIds.add(value.reward_id)
      stateByRewardId.set(
        value.reward_id,
        parseRewardCollectionState(value).state
      )
    }
    if (chunkIds.size !== chunk.length) throw malformedBatch()
  }

  return rewards.map((reward) => ({
    ...reward,
    collection_state: requiredState(stateByRewardId, reward.id),
  }))
}

function requiredState(
  states: ReadonlyMap<string, RewardCollectionState>,
  rewardId: string
): RewardCollectionState {
  const state = states.get(rewardId)
  if (!state) throw malformedBatch()
  return state
}

function malformedBatch(): Error {
  return new Error(
    "Unable to load customer reward status: malformed batch result"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
