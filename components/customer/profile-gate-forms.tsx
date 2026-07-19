"use client"

import { useActionState } from "react"

import {
  resendProfileEmailAction,
  saveProfileForRedeemAction,
  verifyProfileEmailAction,
  type ProfileGateActionState,
} from "@/app/reward/[rewardId]/actions"
import { profileInputClass } from "@/components/customer/profile-form-parts"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { otpFieldMaxLength } from "@/lib/customer/experience/otp-field"
import type { ProfileGate } from "@/lib/customer/experience/types"
import { latestAdultBirthDate } from "@/lib/customer/profile-fields"

const initialState: ProfileGateActionState = {}

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
        Add your name, date of birth, and email before collection.
        {gate.emailLocked
          ? null
          : " We'll send a one-time code to verify a new email."}
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
        max={latestAdultBirthDate()}
        defaultValue={state.fields?.dateOfBirth ?? gate.dateOfBirth ?? ""}
        error={state.errors?.dateOfBirth}
      />
      {gate.emailLocked && gate.email ? (
        <>
          <StatusBanner title="Verified email" tone="neutral">
            {gate.email} is verified and locked for account security.
          </StatusBanner>
          {state.errors?.email ? (
            <StatusBanner title="Code not sent" tone="warning">
              {state.errors.email}
            </StatusBanner>
          ) : null}
        </>
      ) : (
        <Field
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="We'll send a one-time code to verify this email."
          required
          defaultValue={state.fields?.email ?? gate.email ?? ""}
          error={state.errors?.email}
        />
      )}

      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Details not saved">
          {state.errors.form}
        </StatusBanner>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full"
        onFocus={(event) =>
          event.currentTarget.scrollIntoView({ block: "center" })
        }
      >
        {pending
          ? gate.emailLocked
            ? "Saving…"
            : "Sending…"
          : gate.emailLocked
            ? "Save and continue"
            : "Save and email my code"}
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
  const [resendState, resendAction, resendPending] = useActionState(
    resendProfileEmailAction,
    initialState
  )

  return (
    <div className="grid gap-4">
      <StatusBanner title="Confirm your email" tone="neutral">
        Enter the code we sent{email ? ` to ${email}` : ""} to verify your email
        before collection.
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
            maxLength={otpFieldMaxLength()}
            className={`${profileInputClass} font-mono`}
            aria-invalid={Boolean(state.errors?.otp)}
            aria-describedby={
              state.errors?.otp ? "profile-otp-error" : undefined
            }
            onFocus={(event) =>
              event.currentTarget.scrollIntoView({ block: "center" })
            }
          />
          {state.errors?.otp ? (
            // Linked from the input via aria-describedby, matching the shared
            // Field pattern (CUS-P3-09).
            <p id="profile-otp-error" className="text-sm text-destructive">
              {state.errors.otp}
            </p>
          ) : null}
        </div>

        {state.errors?.form ? (
          <StatusBanner tone="warning" title="Email not confirmed">
            {state.errors.form}
          </StatusBanner>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Confirming…" : "Confirm email"}
        </Button>
      </form>

      {/* size="sm" keeps these on the tap contract at the queuing moment —
          declared 36px on fine pointers, 44px floor on touch (CUS-P2-10). */}
      <div className="flex items-center gap-3">
        <form action={resendAction}>
          <input type="hidden" name="rewardId" value={rewardId} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={resendPending}
          >
            {resendPending ? "Sending…" : "Email me a code"}
          </Button>
        </form>
      </div>
      {resendState.errors?.form ? (
        <StatusBanner tone="warning" title="Code not sent">
          {resendState.errors.form}
        </StatusBanner>
      ) : resendState.message ? (
        <StatusBanner tone="success" title={resendState.message} />
      ) : null}
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
  max?: string
  required?: boolean
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
        className={profileInputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...rest}
        onFocus={(event) =>
          event.currentTarget.scrollIntoView({ block: "center" })
        }
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
