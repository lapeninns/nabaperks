"use client"

import { useActionState, useState } from "react"

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
import { type RewardPreset } from "@/lib/merchant/reward-presets"

const initialState: SendRewardState = {}

export function SendRewardForm({
  membershipId,
  memberLabel,
  presets = [],
}: {
  membershipId?: string
  memberLabel?: string
  presets?: readonly RewardPreset[]
}) {
  const [state, action] = useActionState(sendMerchantRewardAction, initialState)
  // Controlled so a preset chip can fill both fields; React preserves these
  // across an error re-render, so the old defaultValue echo-back is no longer
  // needed for name/terms.
  const [rewardName, setRewardName] = useState("")
  const [rewardTerms, setRewardTerms] = useState("")

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

      {presets.length > 0 ? (
        <div className="grid gap-2 rounded-lg bg-secondary/60 p-3">
          <Eyebrow>Quick fill</Eyebrow>
          <div
            role="group"
            aria-label="Reward templates"
            className="flex flex-wrap gap-2"
          >
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  // Prefill only: fills the draft fields; the reward is not sent
                  // until the merchant presses Send reward.
                  setRewardName(preset.rewardName)
                  setRewardTerms(preset.rewardTerms)
                }}
                className="focus-ring rounded-lg border-2 border-dashed border-ink/25 bg-transparent px-3 py-1.5 text-sm font-bold text-foreground transition-[background-color,border-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:border-ink hover:bg-card motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
              >
                {preset.rewardName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Field
        id="send-reward-name"
        name="rewardName"
        label="Reward name"
        hint="What the member sees, e.g. &ldquo;A drink on us&rdquo;."
        value={rewardName}
        onChange={(event) => setRewardName(event.target.value)}
        maxLength={100}
        error={state.errors?.rewardName}
      />
      <TextareaField
        id="send-reward-terms"
        name="rewardTerms"
        label="Reward terms"
        hint="12–500 characters. Anything the member should know before redeeming."
        value={rewardTerms}
        onChange={(event) => setRewardTerms(event.target.value)}
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
            state.fields?.expiresInDays ??
            String(DEFAULT_SEND_REWARD_EXPIRY_DAYS)
          }
          className="surface-card-flat h-12 px-3 text-foreground"
        >
          {SEND_REWARD_EXPIRY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
        {state.errors?.expiresInDays ? (
          <p className="text-sm text-destructive">
            {state.errors.expiresInDays}
          </p>
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
