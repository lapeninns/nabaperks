"use client"

import { useActionState } from "react"

import {
  clearHomeProfileEmailAction,
  resendHomeProfileEmailAction,
  saveHomeProfileAction,
  verifyHomeProfileEmailAction,
  type ProfileEditState,
} from "@/app/home/(authed)/profile/actions"
import { Eyebrow, MonoTag } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const initialState: ProfileEditState = {}

const inputClass =
  "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25 aria-invalid:border-destructive"

export type EditableProfile = {
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailVerified: boolean
  needsEmailVerification: boolean
}

/**
 * Editable Name / Date of birth / Email for the /home profile page. Mirrors the
 * redeem-time gate form, reusing the same helpers and validation — here the
 * fields are always shown, prefilled with the current values.
 */
export function CustomerProfileEditForm({
  profile,
}: {
  profile: EditableProfile
}) {
  const [state, action, pending] = useActionState(
    saveHomeProfileAction,
    initialState
  )

  return (
    <section className="surface-card grid gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Your details</Eyebrow>
        {profile.emailVerified ? (
          <MonoTag tone="leaf">Email verified</MonoTag>
        ) : null}
      </div>

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
          defaultValue={state.fields?.dateOfBirth ?? profile.dateOfBirth ?? ""}
          error={state.errors?.dateOfBirth}
        />
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

        {state.message ? (
          <StatusBanner tone="success" title="Saved">
            {state.message}
          </StatusBanner>
        ) : null}
        {state.errors?.form ? (
          <StatusBanner tone="warning" title="Details not saved">
            {state.errors.form}
          </StatusBanner>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </form>

      {profile.needsEmailVerification ? (
        <ProfileEmailVerify email={profile.email} />
      ) : null}
    </section>
  )
}

function ProfileEmailVerify({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(
    verifyHomeProfileEmailAction,
    initialState
  )

  return (
    <div className="grid gap-3 border-t-2 border-ink/10 pt-4">
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
            className={`${inputClass} font-mono`}
            aria-invalid={Boolean(state.errors?.otp)}
          />
          {state.errors?.otp ? (
            <p className="text-sm text-destructive">{state.errors.otp}</p>
          ) : null}
        </div>

        {state.message ? (
          <StatusBanner tone="success" title="Confirmed">
            {state.message}
          </StatusBanner>
        ) : null}
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
        <form action={resendHomeProfileEmailAction}>
          <Button type="submit" variant="link" size="xs" className="text-xs">
            Email me a new code
          </Button>
        </form>
        <form action={clearHomeProfileEmailAction}>
          <Button type="submit" variant="link" size="xs" className="text-xs">
            Remove email
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
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined

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
        <p id={`${name}-hint`} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
