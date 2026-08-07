"use client"

import { useActionState, useState } from "react"

import {
  clearHomeProfileEmailAction,
  resendHomeProfileEmailAction,
  saveHomeProfileAction,
  verifyHomeProfileEmailAction,
  type ProfileEditState,
} from "@/app/home/(authed)/profile/actions"
import { MonoTag, SectionHeader } from "@/components/brand"
import {
  ProfileDetailRow as DetailRow,
  ProfileEmailDetailRow as EmailDetailRow,
  ProfileField as Field,
  profileInputClass,
} from "@/components/customer/profile-form-parts"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/forms"
import { formatDateOfBirth } from "@/lib/customer/format"
import { latestAdultBirthDate } from "@/lib/customer/profile-fields"

const initialState: ProfileEditState = {}

export type AboutYouProfile = {
  phone: string | null
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailVerified: boolean
  emailLocked: boolean
  needsEmailVerification: boolean
}

type Mode = "view" | "edit" | "verify"

function initialModeFor(profile: AboutYouProfile): Mode {
  if (profile.needsEmailVerification) return "verify"
  if (!profile.fullName || !profile.dateOfBirth) return "edit"
  return "view"
}

/**
 * The identity card. One surface, three modes: a read-only summary (view), the
 * editable form (edit), and the email-confirm step on its own (verify). Server
 * actions are unchanged — the page revalidates after each save, which re-derives
 * the mode from the fresh profile; client-only transitions handle Edit/Cancel.
 */
export function CustomerProfileAboutYou({
  profile,
}: {
  profile: AboutYouProfile
}) {
  const serverMode = initialModeFor(profile)
  const [mode, setMode] = useState<Mode>(serverMode)
  const [saveState, saveAction, savePending] = useActionState(
    saveHomeProfileAction,
    initialState
  )

  // Reconcile mode without effects, via the "compare to the previous render"
  // pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // After a revalidation the server re-derives the mode (confirming or clearing an
  // email, or adding a new one), so follow that truth.
  const [prevServerMode, setPrevServerMode] = useState<Mode>(serverMode)
  if (serverMode !== prevServerMode) {
    setPrevServerMode(serverMode)
    setMode(serverMode)
  }

  // A save that returns inline still needs to leave edit: a new email routes to
  // verify, any other successful save returns to the read-only summary.
  const [seenSaveMessage, setSeenSaveMessage] = useState(saveState.message)
  if (saveState.message !== seenSaveMessage) {
    setSeenSaveMessage(saveState.message)
    if (saveState.message) {
      setMode(/code/i.test(saveState.message) ? "verify" : "view")
    }
  }

  return (
    <section className="surface-card grid gap-4 p-5">
      <SectionHeader eyebrow="About you" title="Your contact details" />

      {mode === "view" ? (
        <AboutYouView profile={profile} onEdit={() => setMode("edit")} />
      ) : null}

      {mode === "edit" ? (
        <AboutYouEditForm
          profile={profile}
          state={saveState}
          action={saveAction}
          pending={savePending}
          onCancel={() => setMode("view")}
        />
      ) : null}

      {mode === "verify" ? <AboutYouEmailVerify email={profile.email} /> : null}
    </section>
  )
}

function AboutYouView({
  profile,
  onEdit,
}: {
  profile: AboutYouProfile
  onEdit: () => void
}) {
  return (
    <div className="grid gap-4">
      <dl className="grid gap-3">
        <DetailRow
          label="Phone"
          value={profile.phone ?? "Not set"}
          tag={profile.phone ? <MonoTag tone="leaf">Verified</MonoTag> : null}
        />
        <DetailRow label="Full name" value={profile.fullName ?? "Not set"} />
        <DetailRow
          label="Date of birth"
          value={
            profile.dateOfBirth
              ? formatDateOfBirth(profile.dateOfBirth)
              : "Not set"
          }
        />
        <EmailDetailRow profile={profile} />
      </dl>

      <p className="text-xs leading-5 text-muted-foreground">
        Verified contact details are locked for account security.
      </p>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onEdit}
      >
        Edit details
      </Button>
    </div>
  )
}

function AboutYouEditForm({
  profile,
  state,
  action,
  pending,
  onCancel,
}: {
  profile: AboutYouProfile
  state: ProfileEditState
  action: (payload: FormData) => void
  pending: boolean
  onCancel: () => void
}) {
  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={state.fields?.fullName ?? profile.fullName ?? ""}
        error={state.errors?.fullName}
      />
      <Field
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        autoComplete="bday"
        max={latestAdultBirthDate()}
        defaultValue={state.fields?.dateOfBirth ?? profile.dateOfBirth ?? ""}
        error={state.errors?.dateOfBirth}
      />
      {profile.emailLocked && profile.email ? (
        <StatusBanner tone="neutral" title="Verified email">
          {profile.email} is verified and locked for account security.
        </StatusBanner>
      ) : (
        <Field
          label="Email (optional)"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="Add one to get reward updates. We'll send a code to confirm it."
          defaultValue={state.fields?.email ?? profile.email ?? ""}
          error={state.errors?.email}
        />
      )}

      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Details not saved">
          {state.errors.form}
        </StatusBanner>
      ) : null}

      <div className="grid gap-2">
        <SubmitButton size="lg" className="w-full" pendingLabel="Saving…">
          Save changes
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

function AboutYouEmailVerify({ email }: { email: string | null }) {
  const [state, action] = useActionState(
    verifyHomeProfileEmailAction,
    initialState
  )

  return (
    <div className="grid gap-3">
      <StatusBanner title="Confirm your email" tone="neutral">
        Enter the code we sent{email ? ` to ${email}` : ""} to verify it.
      </StatusBanner>

      <form action={action} className="grid gap-3">
        <div className="grid gap-2">
          <label htmlFor="home-profile-otp" className="eyebrow">
            Email code
          </label>
          <input
            id="home-profile-otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${profileInputClass} font-mono`}
            aria-invalid={Boolean(state.errors?.otp)}
            aria-describedby={
              state.errors?.otp ? "home-profile-otp-error" : undefined
            }
          />
          {state.errors?.otp ? (
            // Linked from the input via aria-describedby (CUS-P3-09
            // same-class).
            <p id="home-profile-otp-error" className="text-sm text-destructive">
              {state.errors.otp}
            </p>
          ) : null}
        </div>

        {state.errors?.form ? (
          <StatusBanner tone="warning" title="Email not confirmed">
            {state.errors.form}
          </StatusBanner>
        ) : null}

        <SubmitButton size="lg" className="w-full" pendingLabel="Confirming…">
          Confirm email
        </SubmitButton>
      </form>

      {/* size="sm" keeps these on the tap contract at the queuing moment —
          declared 36px on fine pointers, 44px floor on touch (CUS-P2-10). */}
      <div className="flex items-center justify-between gap-3">
        <form action={resendHomeProfileEmailAction}>
          <Button type="submit" variant="link" size="sm">
            Email me a new code
          </Button>
        </form>
        <form action={clearHomeProfileEmailAction}>
          <Button type="submit" variant="link" size="sm">
            Continue without email
          </Button>
        </form>
      </div>
    </div>
  )
}
