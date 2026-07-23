"use client"

import { useActionState } from "react"

import {
  stepUpAdminMfa,
  type AdminMfaFormState,
} from "@/app/admin/security/actions"
import { Eyebrow } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"

const IDLE: AdminMfaFormState = { ok: false, error: null }

/**
 * Full-page step-up prompt shown by the admin layout when an enrolled admin's
 * session is still aal1. It is the only admin surface rendered in that state, so
 * an admin can always reach it and complete the challenge — no lockout.
 */
export function AdminMfaStepUp({ operatorEmail }: { operatorEmail: string }) {
  const [state, action] = useActionState(stepUpAdminMfa, IDLE)

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <section className="surface-card w-full max-w-sm p-6">
        <Eyebrow>Internal admin</Eyebrow>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold">
          Verify it&rsquo;s you
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two-factor authentication is on for {operatorEmail}. Enter the current
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
      </section>
    </main>
  )
}
