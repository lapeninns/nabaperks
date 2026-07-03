"use client"

import { useActionState } from "react"

import {
  sendMerchantRewardAction,
  type SendRewardState,
} from "@/app/app/customers/send-reward/actions"
import { Eyebrow } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Field, TextareaField } from "@/components/merchant/loyalty-card-form"
import {
  DEFAULT_SEND_REWARD_EXPIRY_DAYS,
  SEND_REWARD_EXPIRY_OPTIONS,
} from "@/lib/merchant/send-reward-fields"

const initialState: SendRewardState = {}

export function SendRewardForm({
  membershipId,
  memberLabel,
}: {
  membershipId?: string
  memberLabel?: string
}) {
  const [state, action] = useActionState(sendMerchantRewardAction, initialState)

  if (state.message) {
    return (
      <StatusBanner tone="success" title="Reward sent.">
        {state.message}
      </StatusBanner>
    )
  }

  return (
    <form action={action} className="grid gap-4">
      {membershipId ? (
        <input type="hidden" name="membershipId" value={membershipId} />
      ) : null}

      {membershipId ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Sending to{" "}
          <span className="font-bold text-foreground">
            {memberLabel ?? "the selected member"}
          </span>
          .
        </p>
      ) : (
        <Field
          id="send-reward-contact"
          name="contact"
          label="Member email or phone"
          hint="Matched to your members. If they're new to Nabaperks, it waits until they join."
          defaultValue={state.fields?.contact}
          error={state.errors?.contact}
        />
      )}

      <Field
        id="send-reward-name"
        name="rewardName"
        label="Reward name"
        hint="What the member sees, e.g. &ldquo;A drink on us&rdquo;."
        defaultValue={state.fields?.rewardName}
        maxLength={100}
        error={state.errors?.rewardName}
      />
      <TextareaField
        id="send-reward-terms"
        name="rewardTerms"
        label="Reward terms"
        hint="12–500 characters. Anything the member should know before redeeming."
        defaultValue={state.fields?.rewardTerms}
        maxLength={500}
        error={state.errors?.rewardTerms}
      />

      <div className="grid gap-1.5">
        <label htmlFor="send-reward-expiry">
          <Eyebrow>Expires in</Eyebrow>
        </label>
        <select
          id="send-reward-expiry"
          name="expiresInDays"
          defaultValue={
            state.fields?.expiresInDays ?? String(DEFAULT_SEND_REWARD_EXPIRY_DAYS)
          }
          className="h-12 rounded-lg border-2 border-ink bg-card px-3 text-foreground"
        >
          {SEND_REWARD_EXPIRY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
        {state.errors?.expiresInDays ? (
          <p className="text-sm text-destructive">{state.errors.expiresInDays}</p>
        ) : null}
      </div>

      <TextareaField
        id="send-reward-message"
        name="message"
        label="Message (optional)"
        hint="Up to 200 characters."
        rows={2}
        defaultValue={state.fields?.message}
        maxLength={200}
        error={state.errors?.message}
      />

      {state.errors?.form ? (
        <p className="text-sm text-destructive" role="alert">
          {state.errors.form}
        </p>
      ) : null}

      <SubmitButton className="w-fit" pendingLabel="Sending…">
        Send reward
      </SubmitButton>
    </form>
  )
}
