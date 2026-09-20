import {
  parseRewardCollectionState,
  type RewardCollectionSnapshot,
} from "@/lib/customer/reward-collection-state"

export const MAX_CUSTOMER_REWARD_STATE_BATCH = 256

type BatchResult = {
  readonly data: unknown
  readonly error: { readonly message: string } | null
}

type BatchRpc = (args: {
  readonly p_reward_ids: readonly string[]
}) => Promise<BatchResult>

export async function loadCustomerRewardCollectionStates(
  rewardIds: readonly string[],
  rpc: BatchRpc
): Promise<ReadonlyMap<string, RewardCollectionSnapshot>> {
  const uniqueRewardIds = [...new Set(rewardIds)]
  const states = new Map<string, RewardCollectionSnapshot>()

  for (
    let offset = 0;
    offset < uniqueRewardIds.length;
    offset += MAX_CUSTOMER_REWARD_STATE_BATCH
  ) {
    const chunk = uniqueRewardIds.slice(
      offset,
      offset + MAX_CUSTOMER_REWARD_STATE_BATCH
    )
    const { data, error } = await rpc({ p_reward_ids: chunk })
    if (error) {
      throw new Error(
        `Unable to load reward collection states: ${error.message}`
      )
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
        states.has(value.reward_id)
      ) {
        throw malformedBatch()
      }
      chunkIds.add(value.reward_id)
      states.set(value.reward_id, parseRewardCollectionState(value))
    }
    if (chunkIds.size !== chunk.length) throw malformedBatch()
  }

  return states
}

function malformedBatch(): Error {
  return new Error(
    "Unable to load reward collection states: malformed batch result"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * One-release compatibility for an application deployed ahead of its
 * migration: the batch RPC is absent, so every reward reads as a conservative
 * placeholder block, exactly as the legacy card read reports it. The home page
 * then shows the pending reward without a collection promise instead of
 * failing outright.
 */
export function legacyRewardCollectionBatch(
  rewardIds: readonly string[]
): Array<{
  reward_id: string
  state: "blocked"
  reason: string
  available_from: null
  expires_at: null
}> {
  return rewardIds.map((rewardId) => ({
    reward_id: rewardId,
    state: "blocked",
    reason: "Reward collection status is updating",
    available_from: null,
    expires_at: null,
  }))
}
