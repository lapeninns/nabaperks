"use client"

import { useActionState } from "react"

import {
  clearProfileEmailAction,
  resendProfileEmailAction,
  saveProfileForRedeemAction,
  verifyProfileEmailAction,
  type ProfileGateActionState,
} from "@/app/reward/[rewardId]/actions"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import type { ProfileGate } from "@/lib/customer/experience/types"

const initialState: ProfileGateActionState = {}

const inputClass =
  "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25 aria-invalid:border-destructive"

export function CustomerProfileGateForm({
  rewardId,
  gate,
}: {
  rewardId: string
  gate: ProfileGate
}) {
  if (gate.needsEmailVerification) {
    return <ProfileEmailStep rewardId={rewardId} email={gate.email} />
  }

  return <ProfileDetailsStep rewardId={rewardId} gate={gate} />
}

function ProfileDetailsStep({
  rewardId,
  gate,
}: {
  rewardId: string
  gate: ProfileGate
}) {
  const [state, action, pending] = useActionState(
    saveProfileForRedeemAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="rewardId" value={rewardId} />

      <StatusBanner
        title="A few details before this one's yours"
        tone="neutral"
      >
        Add your name and date of birth before collection. Email is optional.
      </StatusBanner>

      <Field
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={state.fields?.fullName ?? gate.fullName ?? ""}
        error={state.errors?.fullName}
      />
      <Field
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        autoComplete="bday"
        defaultValue={state.fields?.dateOfBirth ?? gate.dateOfBirth ?? ""}
        error={state.errors?.dateOfBirth}
      />
      {gate.emailLocked && gate.email ? (
        <StatusBanner title="Verified email" tone="neutral">
          {gate.email} is verified and locked for account security.
        </StatusBanner>
      ) : (
        <Field
          label="Email (optional)"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="We'll send a code to confirm it."
          defaultValue={state.fields?.email ?? gate.email ?? ""}
          error={state.errors?.email}
        />
      )}

      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Details not saved">
          {state.errors.form}
        </StatusBanner>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Save my details"}
      </Button>
    </form>
  )
}

function ProfileEmailStep({
  rewardId,
  email,
}: {
  rewardId: string
  email: string | null
}) {
  const [state, action, pending] = useActionState(
    verifyProfileEmailAction,
    initialState
  )

  return (
    <div className="grid gap-4">
      <StatusBanner title="Confirm your email" tone="neutral">
        Enter the code we sent{email ? ` to ${email}` : ""} to finish your
        profile.
      </StatusBanner>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="rewardId" value={rewardId} />
        <div className="grid gap-2">
          <label htmlFor="profile-otp" className="eyebrow">
            Email code
          </label>
          <input
            id="profile-otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputClass} font-mono`}
            aria-invalid={Boolean(state.errors?.otp)}
          />
          {state.errors?.otp ? (
            <p className="text-sm text-destructive">{state.errors.otp}</p>
          ) : null}
        </div>

        {state.errors?.form ? (
          <StatusBanner tone="warning" title="Email not confirmed">
            {state.errors.form}
          </StatusBanner>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Confirming..." : "Confirm email"}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3">
        <form action={resendProfileEmailAction}>
          <input type="hidden" name="rewardId" value={rewardId} />
          <Button type="submit" variant="link" size="xs" className="text-xs">
            Email me a new code
          </Button>
        </form>
        <form action={clearProfileEmailAction}>
          <input type="hidden" name="rewardId" value={rewardId} />
          <Button type="submit" variant="link" size="xs" className="text-xs">
            Continue without email
          </Button>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  error,
  hint,
  type = "text",
  ...rest
}: {
  label: string
  name: string
  error?: string
  hint?: string
  type?: string
  defaultValue?: string
  autoComplete?: string
  inputMode?: "email" | "numeric"
}) {
  const describedBy = error
    ? `${name}-error`
    : hint
      ? `${name}-hint`
      : undefined

  return (
    <div className="grid gap-2">
      <label htmlFor={name} className="eyebrow">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${name}-hint`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
