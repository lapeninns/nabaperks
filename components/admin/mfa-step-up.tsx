"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Eyebrow } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { stepUpAdminWebAuthn } from "@/lib/admin/webauthn-mfa"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser"

export function AdminMfaStepUp({ operatorEmail }: { operatorEmail: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [verifying, startTransition] = useTransition()

  const verify = () =>
    startTransition(async () => {
      setError(null)
      const result = await stepUpAdminWebAuthn(getSupabaseBrowserClient())
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <section className="surface-card w-full max-w-sm p-6">
        <Eyebrow>Internal admin</Eyebrow>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold">
          Verify it&rsquo;s you
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two-factor authentication is on for {operatorEmail}. Use the enrolled
          passkey or security key to continue.
        </p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-5 w-full"
          disabled={verifying}
          onClick={verify}
          autoFocus
        >
          {verifying ? "Waiting for your device…" : "Verify with security key"}
        </Button>
      </section>
    </main>
  )
}
