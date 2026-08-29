"use client"

import { useActionState, useState, useTransition } from "react"

import {
  beginAdminMfaEnrollment,
  unenrollAdminMfa,
  verifyAdminMfaEnrollment,
  type AdminMfaEnrollment,
  type AdminMfaFormState,
} from "@/app/admin/security/actions"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { AdminConfirmCheck, AdminPanel } from "@/components/admin/support"
import { Eyebrow, Icon, SectionHeader } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { QrFrame } from "@/components/loyalty"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

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

  // AdminPanel + SectionHeader, not `surface-card space-y-4 p-6` with a
  // text-xl heading: the console's panel anatomy is p-5 / gap-4 / text-lg.
  return (
    <AdminPanel>
      <SectionHeader
        title="Two-factor authentication is on"
        description="Admin sign-in requires a 6-digit authenticator code. Keep your recovery options safe — losing the authenticator means losing admin access."
      />
      {factorId ? (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="factorId" value={factorId} />
          {state.error ? (
            <div role="alert">
              <StatusBanner tone="error" title={state.error} />
            </div>
          ) : null}
          {/* Removing the second factor weakens admin access and cannot be
              undone without a fresh enrolment, so it takes the destructive
              weight and the same irreversibility gate as the other admin
              write actions (AdminConfirmCheck). */}
          <AdminConfirmCheck label="I understand admin sign-in will no longer require an authenticator code." />
          <SubmitButton
            variant="destructive"
            pendingLabel="Removing…"
            className="w-fit"
          >
            Turn off two-factor
          </SubmitButton>
        </form>
      ) : null}
    </AdminPanel>
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
      <AdminPanel>
        {/* Step counter: pressing "Set up" swapped the whole card body with no
            indication that this is a two-step machine. */}
        <Eyebrow>Step 1 of 2</Eyebrow>
        <SectionHeader
          title="Set up two-factor authentication"
          description="Protect the admin console with a 6-digit code from an authenticator app (for example Google Authenticator or 1Password)."
        />
        {enrollment && !enrollment.ok ? (
          <div role="alert">
            <StatusBanner tone="error" title={enrollment.error} />
          </div>
        ) : null}
        {/* One pending idiom: the hand-rolled `starting ? "Starting…"` label
            had no Spinner and no aria-busy, so this was the only action in the
            console whose busy state was not announced. */}
        <Button
          type="button"
          onClick={begin}
          disabled={starting}
          aria-busy={starting || undefined}
          className="w-fit"
        >
          {starting ? (
            <>
              <Spinner aria-hidden="true" role="presentation" />
              Starting…
            </>
          ) : (
            "Set up two-factor"
          )}
        </Button>
      </AdminPanel>
    )
  }

  return (
    <AdminPanel>
      <Eyebrow>Step 2 of 2</Eyebrow>
      <SectionHeader
        title="Scan and confirm"
        description="Scan this with your authenticator app, or copy the key by hand, then confirm the current code."
      />
      {/* The system's ONE QR treatment, not a hand-rolled copy of its class
          string (04#39). `QrFrame` takes `children: ReactNode`, so an <img>
          composes exactly as the marketing venue QR's <svg> does — the reason
          this was left as a look-alike ("the frame API takes a matrix") is not
          true of the component. Composing it means this QR also inherits the
          frame's `text-qr` ground, its offset shadow and its `figure`
          semantics, and cannot drift from the other three QR surfaces.
          w-fit: the frame is a block figure and would otherwise stretch to the
          panel's full width around a 176px image. */}
      <QrFrame label="Authenticator setup QR code" className="w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: SVG QR minted server-side by Supabase enrol */}
        <img
          src={enrollment.qrCodeSvg}
          alt="Authenticator setup QR code"
          className="h-44 w-44"
        />
      </QrFrame>
      {/* Transcribing a 32-character base32 secret is the highest-error step
          of enrolment, and it used to be break-all mono text with no copy
          control — the only identifier in the console without one. Grouped in
          4-character blocks for reading, copied in full. */}
      <div className="grid gap-2">
        <Eyebrow>Setup key</Eyebrow>
        <p className="mono-meta break-words text-muted-foreground normal-case">
          {groupSecret(enrollment.secret)}
        </p>
        <CopyKeyButton secret={enrollment.secret} />
      </div>
      <form action={verifyAction} className="grid gap-4">
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
        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel="Confirming…">
            Confirm and turn on
          </SubmitButton>
          {/* No way back: an operator who could not scan was trapped in the
              second state with no way to abandon the started enrolment. */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEnrollment(null)}
          >
            Back
          </Button>
        </div>
      </form>
    </AdminPanel>
  )
}

/** `ABCD EFGH …` — grouped for transcription, copied whole. */
function groupSecret(secret: string) {
  return secret.replaceAll(/(.{4})/g, "$1 ").trim()
}

function CopyKeyButton({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="w-fit"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(secret)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          // Clipboard unavailable: the key is on screen and selectable.
        }
      }}
    >
      <Icon icon={copied ? Tick02Icon : Copy01Icon} size={16} />
      {copied ? "Key copied" : "Copy key"}
    </Button>
  )
}
