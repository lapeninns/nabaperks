"use client"

import { useActionState, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  authorizeAdminMfaEnrollment,
  unenrollAdminMfa,
  type AdminMfaFormState,
} from "@/app/admin/security/actions"
import { SubmitButton } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { registerAdminWebAuthnFactor } from "@/lib/admin/webauthn-mfa"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser"

const IDLE: AdminMfaFormState = { ok: false, error: null }

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
        Admin sign-in requires your passkey or security key. Keep the key and
        its device recovery options safe — losing it means losing admin access.
      </p>
      {factorId ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="factorId" value={factorId} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <SubmitButton variant="outline" pendingLabel="Removing…">
            Turn off two-factor
          </SubmitButton>
        </form>
      ) : null}
    </div>
  )
}

function EnrollPanel() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [starting, startTransition] = useTransition()

  const begin = () =>
    startTransition(async () => {
      setError(null)
      const authorisation = await authorizeAdminMfaEnrollment()
      if (!authorisation.ok) {
        setError(authorisation.error)
        return
      }

      const result = await registerAdminWebAuthnFactor(
        getSupabaseBrowserClient()
      )
      if (!result.ok) {
        setError(result.error)
        return
      }

      router.refresh()
    })

  return (
    <div className="surface-card space-y-4 p-6">
      <h2 className="text-xl font-extrabold">
        Set up two-factor authentication
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Protect the admin console with a device passkey or hardware security
        key. Your browser will require its screen lock, fingerprint, face or key
        PIN before the credential can be used.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" onClick={begin} disabled={starting}>
        {starting
          ? "Waiting for your device…"
          : "Set up passkey or security key"}
      </Button>
    </div>
  )
}
