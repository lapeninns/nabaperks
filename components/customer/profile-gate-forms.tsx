"use client"

import { useActionState, useState } from "react"

import {
  clearProfileEmailAction,
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
  // Ask for a code only while one for the saved address is pending for this
  // customer; otherwise offer to send one (QA BUG-036).
  const codePending = gate.emailCodePending !== false
  // Owned here, not by the code step: a refused (conflict) confirmation
  // releases the address, so the re-rendered gate returns to the details step
  // and the code step unmounts. Its answer must outlive that (QA BUG-005).
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyProfileEmailAction,
    initialState
  )
  // The email stage starts with the address itself when none is on file; the
  // code (or the offer to send one) follows once an address is saved.
  const emailAddressMissing = stage === "email" && !gate.email
  const freshVerifyState = useFreshVerifyState(
    verifyState,
    stage !== "email" || emailAddressMissing
      ? null
      : codePending
        ? "code"
        : "send"
  )

  if (stage === "phone") {
    // The shell keeps the reward named above this step, and a confirmed
    // number revalidates this route, so the guest stays on the reward. Any
    // follow-up (a fresh sign-in, a stamps link) returns here, not to Profile.
    return (
      <CustomerProfileAddPhone
        action={rewardPhoneAction}
        returnTo={`/reward/${rewardId}`}
      />
    )
  }
  if (stage === "email" && !emailAddressMissing) {
    return (
      <ProfileEmailStep
        rewardId={rewardId}
        email={gate.email}
        codePending={codePending}
        verify={[freshVerifyState, verifyAction, verifyPending]}
      />
    )
  }

  return (
    <ProfileDetailsStep
      rewardId={rewardId}
      gate={gate}
      emailOnly={emailAddressMissing}
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
 * another address must not show the previous address's refusal. A refusal
 * that also withdrew the code (the step falls back from "code" to "send")
 * keeps its answer.
 */
function useFreshVerifyState(
  state: ProfileGateActionState,
  emailStep: "code" | "send" | null
): ProfileGateActionState {
  const [staleState, setStaleState] = useState<ProfileGateActionState | null>(
    null
  )
  const [prevEmailStep, setPrevEmailStep] = useState(emailStep)
  if (emailStep !== prevEmailStep) {
    setPrevEmailStep(emailStep)
    if (emailStep === "code" || (emailStep && !prevEmailStep)) {
      setStaleState(state)
    }
  }
  return state === staleState ? initialState : state
}

/**
 * One requirement per screen. The details step asks for name and date of
 * birth only (`part=details`); the email is its own step after it. With
 * `emailOnly`, name and date of birth are already saved: they ride along as
 * hidden fields for the same server action, and the form asks only for the
 * address.
 */
function ProfileDetailsStep({
  rewardId,
  gate,
  emailOnly,
  emailNotConfirmed,
}: {
  rewardId: string
  gate: ProfileGate
  emailOnly: boolean
  /** Why the last emailed code did not confirm the address, if it did not. */
  emailNotConfirmed?: string
}) {
  const [state, action, pending] = useActionState(
    saveProfileForRedeemAction,
    initialState
  )
  const askEmail = emailOnly && !gate.emailLocked

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="rewardId" value={rewardId} />
      {emailOnly ? null : <input type="hidden" name="part" value="details" />}

      {/* The screen headline names this step, so the lead says only what the
          fields on this screen are for. Photo ID and later steps are not
          mentioned here: they are shown when they are next. */}
      <p className="text-sm leading-6 text-muted-foreground">
        {emailOnly
          ? "Add your email address. We'll send you a code to confirm it."
          : "Venues need your name and date of birth before handing over a reward."}
      </p>

      {emailNotConfirmed ? (
        <StatusBanner tone="warning" title="Email not confirmed">
          {emailNotConfirmed}
        </StatusBanner>
      ) : null}

      {emailOnly ? (
        <>
          <input type="hidden" name="fullName" value={gate.fullName ?? ""} />
          <input
            type="hidden"
            name="dateOfBirth"
            value={gate.dateOfBirth ?? ""}
          />
        </>
      ) : (
        <>
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
        </>
      )}
      {emailOnly && (state.errors?.fullName || state.errors?.dateOfBirth) ? (
        <StatusBanner tone="warning" title="Details not saved">
          {state.errors.fullName ?? state.errors.dateOfBirth}
        </StatusBanner>
      ) : null}
      {askEmail ? (
        <Field
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          hint="We'll send you a code to confirm it."
          defaultValue={state.fields?.email ?? gate.email ?? ""}
          error={state.errors?.email}
        />
      ) : state.errors?.email ? (
        <StatusBanner title="Code not sent" tone="warning">
          {state.errors.email}
        </StatusBanner>
      ) : null}

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
  codePending,
  verify,
}: {
  rewardId: string
  email: string | null
  /** A code for `email` is on its way; otherwise offer to send one. */
  codePending: boolean
  verify: VerifyActionState
}) {
  const [state, action, pending] = verify
  const [resendState, resendAction, resendPending] = useActionState(
    resendProfileEmailAction,
    initialState
  )
  const resendAnswer = resendState.errors?.form ? (
    <StatusBanner tone="warning" title="Code not sent">
      {resendState.errors.form}
    </StatusBanner>
  ) : resendState.message ? (
    <StatusBanner tone="success" title={resendState.message} />
  ) : null

  if (!codePending) {
    return (
      <div className="grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          We&apos;ll send a code to {email ?? "your email"} to confirm it.
        </p>
        {state.errors?.otp ? (
          <p className="text-sm text-destructive">{state.errors.otp}</p>
        ) : null}
        {state.errors?.form ? (
          <StatusBanner tone="warning" title="Email not confirmed">
            {state.errors.form}
          </StatusBanner>
        ) : null}
        <form action={resendAction}>
          <input type="hidden" name="rewardId" value={rewardId} />
          <Button
            type="submit"
            size="lg"
            disabled={resendPending}
            className="w-full hover:bg-primary"
          >
            {resendPending ? "Sending…" : "Send me a code"}
          </Button>
        </form>
        {resendAnswer}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Enter the code we sent{email ? ` to ${email}` : ""}.
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
      <div className="flex flex-wrap items-center gap-3">
        <form action={resendAction}>
          <input type="hidden" name="rewardId" value={rewardId} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={resendPending}
          >
            {resendPending ? "Sending…" : "Send a new code"}
          </Button>
        </form>
        {/* Releases the unconfirmed address only; a confirmed email is never
            cleared from here (the server action refuses it). */}
        <form action={clearProfileEmailAction}>
          <input type="hidden" name="rewardId" value={rewardId} />
          <Button type="submit" variant="link" size="sm">
            Change email
          </Button>
        </form>
      </div>
      {resendAnswer}
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
