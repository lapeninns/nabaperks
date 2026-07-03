"use client"

import { useActionState, useState } from "react"

import {
  saveBirthdayRewardAction,
  type BirthdayRewardActionState,
} from "@/app/app/card/actions"
import { SubmitButton } from "@/components/forms"
import {
  Field,
  TextareaField,
  ToggleRow,
} from "@/components/merchant/loyalty-card-form"

const initialState: BirthdayRewardActionState = {}

export function BirthdayRewardForm({
  loyaltyCardId,
  initialValues,
}: {
  loyaltyCardId: string
  initialValues: {
    enabled: boolean
    rewardName: string
    rewardTerms: string
  }
}) {
  const [state, action] = useActionState(saveBirthdayRewardAction, initialState)
  const [enabled, setEnabled] = useState(
    state.fields?.enabled ?? initialValues.enabled
  )
  const rewardName = state.fields?.rewardName ?? initialValues.rewardName
  const rewardTerms = state.fields?.rewardTerms ?? initialValues.rewardTerms

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
      <ToggleRow
        name="enabled"
        label="Give a birthday treat"
        hint="Members with a saved birthday get this reward automatically during their birthday month."
        checked={enabled}
        onChange={setEnabled}
      />

      {enabled ? (
        <div className="grid gap-4">
          <Field
            id="birthday-reward-name"
            name="rewardName"
            label="Reward name"
            hint="What the member sees, e.g. “Birthday drink”."
            defaultValue={rewardName}
            maxLength={100}
            error={state.errors?.rewardName}
          />
          <TextareaField
            id="birthday-reward-terms"
            name="rewardTerms"
            label="Reward terms"
            hint="12–500 characters. Anything the member should know before they redeem."
            defaultValue={rewardTerms}
            maxLength={500}
            error={state.errors?.rewardTerms}
          />
        </div>
      ) : (
        // Keep the stored copy on a disabled save so re-enabling doesn't retype.
        <>
          <input type="hidden" name="rewardName" value={rewardName} />
          <input type="hidden" name="rewardTerms" value={rewardTerms} />
        </>
      )}

      {state.errors?.form ? (
        <p className="text-sm text-destructive" role="alert">
          {state.errors.form}
        </p>
      ) : null}

      <SubmitButton className="w-fit" pendingLabel="Saving…">
        Save birthday reward
      </SubmitButton>
    </form>
  )
}
