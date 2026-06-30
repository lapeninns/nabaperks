"use client"

import { useActionState } from "react"

import {
  confirmMerchantRewardCollectionAction,
  type MerchantRewardCollectionActionState,
} from "@/app/app/rewards/scan/[scanToken]/actions"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const initialState: MerchantRewardCollectionActionState = {}

export function MerchantRewardCollectionForm({
  scanToken,
}: {
  scanToken: string
}) {
  const [state, action, pending] = useActionState(
    confirmMerchantRewardCollectionAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="scanToken" value={scanToken} />
      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Reward not collected">
          {state.errors.form}
        </StatusBanner>
      ) : null}
      <Button type="submit" size="lg" variant="reward" disabled={pending}>
        {pending ? "Marking collected..." : "Mark reward collected"}
      </Button>
    </form>
  )
}
