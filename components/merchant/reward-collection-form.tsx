"use client"

import { useActionState } from "react"

import {
  confirmMerchantRewardCollectionAction,
  type MerchantRewardCollectionActionState,
} from "@/app/app/rewards/scan/[rewardId]/actions"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const initialState: MerchantRewardCollectionActionState = {}

export function MerchantRewardCollectionForm({
  rewardId,
}: {
  rewardId: string
}) {
  const [state, action, pending] = useActionState(
    confirmMerchantRewardCollectionAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="rewardId" value={rewardId} />
      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Reward not collected">
          {state.errors.form}
        </StatusBanner>
      ) : null}
      <Button type="submit" size="lg" variant="reward" disabled={pending}>
        {pending ? "Collecting..." : "Collect reward"}
      </Button>
    </form>
  )
}
