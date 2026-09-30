"use client"

import { useActionState, useState } from "react"

import {
  resendProfileEmailAction,
  saveProfileForRedeemAction,
  verifyProfileEmailAction,
  type ProfileGateActionState,
} from "@/app/reward/[rewardId]/actions"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { CustomerProfileAddPhone } from "@/components/customer/profile-add-phone"
import { rewardPhoneAction } from "@/app/home/(authed)/profile/phone-actions"
import { profileInputClass } from "@/components/customer/profile-form-parts"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { collectionSetup } from "@/lib/customer/experience/collection-stage"
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
  const stage = collectionSetup(gate).stage
  // Owned here, not by the code step: a refused (conflict) confirmation
  // releases the address, so the re-rendered gate returns to the details step
  // and the code step unmounts. Its answer must outlive that (QA BUG-005).
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyProfileEmailAction,
    initialState
  )
  const freshVerifyState = useFreshVerifyState(verifyState, stage === "email")

  if (stage === "phone") {
    return <CustomerProfileAddPhone action={rewardPhoneAction} />
  }
  if (stage === "email") {
    return (
      <ProfileEmailStep
        rewardId={rewardId}
        email={gate.email}
        verify={[freshVerifyState, verifyAction, verifyPending]}
      />
    )
  }

  return (
    <ProfileDetailsStep
      rewardId={rewardId}
      gate={gate}
      // Only a refused (conflict) address is answered here: it is the one
      // refusal that removes the address from the gate (QA BUG-005).
      emailNotConfirmed={gate.email ? undefined : freshVerifyState.errors?.form}
    />
  )
}

type VerifyActionState = [
  ProfileGateActionState,
  (payload: FormData) => void,
  boolean,
]

/**
 * The last confirmation answer, until a new code step opens: a code sent for
 * another address must not show the previous address's refusal.
 */
function useFreshVerifyState(
  state: ProfileGateActionState,
  codeStepOpen: boolean
): ProfileGateActionState {
  const [staleState, setStaleState] = useState<ProfileGateActionState | null>(
    null
  )
  const [prevCodeStepOpen, setPrevCodeStepOpen] = useState(codeStepOpen)
  if (codeStepOpen !== prevCodeStepOpen) {
    setPrevCodeStepOpen(codeStepOpen)
    if (codeStepOpen) setStaleState(state)
  }
  return state === staleState ? initialState : state
}

function ProfileDetailsStep({
  rewardId,
  gate,
  emailNotConfirmed,
}: {
  rewardId: string
  gate: ProfileGate
  /** Why the last emailed code did not confirm the address, if it did not. */
  emailNotConfirmed?: string
}) {
  const [state, action, pending] = useActionState(
    saveProfileForRedeemAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="rewardId" value={rewardId} />

      {/* The screen headline already names this step, so the lead says only
          what the details are for. Checking photo ID is a separate thing the
          venue does in person and is never mentioned here. */}
      <p className="text-sm leading-6 text-muted-foreground">
        Venues need your name and date of birth before a reward can be handed
        over.
        {gate.emailLocked
          ? null
          : " A verified email is also required. We'll send a one-time code to confirm your address."}
      </p>

      {emailNotConfirmed ? (
        <StatusBanner tone="warning" title="Email not confirmed">
          {emailNotConfirmed}
        </StatusBanner>
      ) : null}

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
          required
          hint="Verify your email before collecting a reward."
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
        className="w-full hover:bg-primary"
        onFocus={(event) =>
          event.currentTarget.scrollIntoView({ block: "center" })
        }
      >
        {pending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  )
}

function ProfileEmailStep({
  rewardId,
  email,
  verify,
}: {
  rewardId: string
  email: string | null
  verify: VerifyActionState
}) {
  const [state, action, pending] = verify
  const [resendState, resendAction, resendPending] = useActionState(
    resendProfileEmailAction,
    initialState
  )

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Enter the code we sent{email ? ` to ${email}` : ""}. This confirms the
        address only — your details are already saved.
      </p>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="rewardId" value={rewardId} />
        <div className="grid gap-2">
          <label htmlFor="profile-otp" className="eyebrow">
            Email code
          </label>
          <CustomerOtpInput
            id="profile-otp"
            name="otp"
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

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="w-full hover:bg-primary"
        >
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
