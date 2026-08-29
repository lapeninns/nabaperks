"use client"

import { useActionState } from "react"

import {
  confirmMerchantRewardCollectionAction,
  type MerchantRewardCollectionActionState,
} from "@/app/app/rewards/scan/[scanToken]/actions"
import { StatusBanner } from "@/components/loyalty"
import { SubmitButton } from "@/components/forms"

const initialState: MerchantRewardCollectionActionState = {}

export function MerchantRewardCollectionForm({
  scanToken,
}: {
  scanToken: string
}) {
  const [state, action] = useActionState(
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
      <SubmitButton
        size="lg"
        variant="reward"
        pendingLabel="Marking collected…"
      >
        Mark reward collected
      </SubmitButton>
    </form>
  )
}
