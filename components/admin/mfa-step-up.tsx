"use client"

import type { ComponentProps } from "react"
import { useActionState } from "react"

import {
  stepUpAdminMfa,
  type AdminMfaFormState,
} from "@/app/admin/security/actions"
import { Eyebrow, MonoTag } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const IDLE: AdminMfaFormState = { ok: false, error: null }

/**
 * Full-page step-up prompt shown by the admin layout when an enrolled admin's
 * session is still aal1. It is the only admin surface rendered in that state, so
 * an admin can always reach it and complete the challenge — no lockout.
 */
export function AdminMfaStepUp({
  operatorEmail,
  signOutAction,
}: {
  operatorEmail: string
  /** Lets a locked-out operator end the session from the wall itself. */
  signOutAction?: ComponentProps<"form">["action"]
}) {
  const [state, action] = useActionState(stepUpAdminMfa, IDLE)

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <section className="surface-card w-full max-w-sm p-6">
        <Eyebrow>Internal admin</Eyebrow>
        <h1 className="type-page-title mt-2">Verify it&rsquo;s you</h1>
        {/* The account reads as a tag, not as prose mid-sentence — on a wall
            that is the only rendered admin surface, "which account am I?" is
            the first question. */}
        <p className="mt-3">
          <MonoTag tone="ink" className="max-w-full truncate">
            {operatorEmail}
          </MonoTag>
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two-factor authentication is on for this account. Enter the current
          6-digit code from your authenticator app to continue.
        </p>
        <form action={action} className="mt-5 space-y-4">
          <FormField
            id="admin-mfa-step-up-code"
            label="Authenticator code"
            error={state.error ?? undefined}
          >
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              autoFocus
            />
          </FormField>
          <SubmitButton pendingLabel="Verifying…" className="w-full">
            Verify
          </SubmitButton>
        </form>
        {/* This card used to be a dead end: a code field and nothing else. An
            operator with a lost or drifted authenticator had no next action
            inside the product and could not even end the session. */}
        <div className="mt-5 grid gap-3 border-t-2 border-dashed border-line pt-4">
          <p className="text-xs leading-5 text-muted-foreground">
            Codes are time-based: if the app clock has drifted, wait for the
            next code before retrying. If the authenticator is lost, sign out
            and ask another internal admin to reset your factor — enrolment
            cannot be recovered from this screen.
          </p>
          {signOutAction ? (
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-center"
              >
                Sign out
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  )
}
