"use client"

import { useActionState, useState, useTransition } from "react"

import {
  beginAdminMfaEnrollment,
  unenrollAdminMfa,
  verifyAdminMfaEnrollment,
  type AdminMfaEnrollment,
  type AdminMfaFormState,
} from "@/app/admin/security/actions"
import { AdminConfirmCheck } from "@/components/admin/support"
import { FormField, SubmitButton } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const IDLE: AdminMfaFormState = { ok: false, error: null }

/**
 * Admin security surface. When no factor is enrolled it walks the operator
 * through TOTP enrolment (enrol → scan → confirm); when a factor exists it shows
 * status and an opt-out. The layout only renders this page when MFA is NOT in a
 * step-up-required state, so enrolment and management are always reachable.
 */
export function AdminMfaPanel({
  enrolled,
  factorId,
}: {
  enrolled: boolean
  factorId: string | null
}) {
  return enrolled ? <EnrolledPanel factorId={factorId} /> : <EnrollPanel />
}

function EnrolledPanel({ factorId }: { factorId: string | null }) {
  const [state, action] = useActionState(unenrollAdminMfa, IDLE)

  return (
    <div className="surface-card space-y-4 p-6">
      <h2 className="text-xl font-extrabold">
        Two-factor authentication is on
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Admin sign-in requires a 6-digit authenticator code. Keep your recovery
        options safe — losing the authenticator means losing admin access.
      </p>
      {factorId ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="factorId" value={factorId} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {/* Removing the second factor weakens admin access and cannot be
              undone without a fresh enrolment, so it takes the destructive
              weight and the same irreversibility gate as the other admin
              write actions (AdminConfirmCheck). */}
          <AdminConfirmCheck label="I understand admin sign-in will no longer require an authenticator code." />
          <SubmitButton variant="destructive" pendingLabel="Removing…">
            Turn off two-factor
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}

function EnrollPanel() {
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment | null>(null)
  const [starting, startTransition] = useTransition()
  const [verifyState, verifyAction] = useActionState(
    verifyAdminMfaEnrollment,
    IDLE
  )

  const begin = () =>
    startTransition(async () => {
      setEnrollment(await beginAdminMfaEnrollment())
    })

  if (!enrollment?.ok) {
    return (
      <div className="surface-card space-y-4 p-6">
        <h2 className="text-xl font-extrabold">
          Set up two-factor authentication
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Protect the admin console with a 6-digit code from an authenticator
          app (for example Google Authenticator or 1Password).
        </p>
        {enrollment && !enrollment.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {enrollment.error}
          </p>
        ) : null}
        <Button type="button" onClick={begin} disabled={starting}>
          {starting ? "Starting…" : "Set up two-factor"}
        </Button>
      </div>
    )
  }

  return (
    <div className="surface-card space-y-4 p-6">
      <h2 className="text-xl font-extrabold">Scan and confirm</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Scan this with your authenticator app, or enter the key by hand, then
        confirm the current code.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data: SVG QR minted server-side by Supabase enrol */}
      <img
        src={enrollment.qrCodeSvg}
        alt="Authenticator setup QR code"
        className="h-44 w-44 rounded-lg border-2 border-ink bg-qr-foreground p-2"
      />
      <p className="font-mono text-xs break-all text-muted-foreground">
        Key: {enrollment.secret}
      </p>
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <FormField
          id="admin-mfa-enroll-code"
          label="Authenticator code"
          error={verifyState.error ?? undefined}
        >
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
          />
        </FormField>
        <SubmitButton pendingLabel="Confirming…">
          Confirm and turn on
        </SubmitButton>
      </form>
    </div>
  )
}
