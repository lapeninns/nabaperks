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
import type { BirthdayRewardTemplate } from "@/lib/merchant/birthday-reward-template"

const initialState: BirthdayRewardActionState = {}

export function BirthdayRewardForm({
  loyaltyCardId,
  initialValues,
  template,
}: {
  loyaltyCardId: string
  initialValues: {
    enabled: boolean
    rewardName: string
    rewardTerms: string
  }
  template: BirthdayRewardTemplate
}) {
  const [state, action] = useActionState(saveBirthdayRewardAction, initialState)
  const [enabled, setEnabled] = useState(
    state.fields?.enabled ?? initialValues.enabled
  )
  const [rewardName, setRewardName] = useState(
    state.fields?.rewardName ?? initialValues.rewardName
  )
  const [rewardTerms, setRewardTerms] = useState(
    state.fields?.rewardTerms ?? initialValues.rewardTerms
  )

  function handleToggle(next: boolean) {
    setEnabled(next)
    if (next) {
      // Prefill blank fields with the business-typed template when the treat is
      // switched on.
      setRewardName((current) =>
        current.trim() ? current : template.rewardName
      )
      setRewardTerms((current) =>
        current.trim() ? current : template.rewardTerms
      )
    } else {
      // Switching off drops an un-saved template so a disabled save never
      // persists copy the merchant did not commit; a saved reward is restored.
      setRewardName(initialValues.rewardName)
      setRewardTerms(initialValues.rewardTerms)
    }
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
      <ToggleRow
        name="enabled"
        label="Give a birthday treat"
        hint="Members with a saved birthday get this reward automatically during their birthday month."
        checked={enabled}
        onChange={handleToggle}
      />

      {enabled ? (
        <div className="grid gap-4">
          <Field
            id="birthday-reward-name"
            name="rewardName"
            label="Reward name"
            hint="What the member sees, e.g. “Birthday drink”."
            value={rewardName}
            onChange={(event) => setRewardName(event.target.value)}
            maxLength={100}
            error={state.errors?.rewardName}
          />
          <TextareaField
            id="birthday-reward-terms"
            name="rewardTerms"
            label="Reward terms"
            hint="12–500 characters. Anything the member should know before they redeem."
            value={rewardTerms}
            onChange={(event) => setRewardTerms(event.target.value)}
            maxLength={500}
            error={state.errors?.rewardTerms}
          />
        </div>
      ) : (
        // A disabled save carries the stored copy (empty for a new reward), never
        // an un-saved template — handleToggle restores initialValues on switch-off.
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
