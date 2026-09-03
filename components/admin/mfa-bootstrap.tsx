"use client"

import { useState, useTransition } from "react"

import { Eyebrow } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { registerAdminWebAuthnFactor } from "@/lib/admin/webauthn-mfa"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser"

type Stage = "email" | "code" | "ready" | "complete"

export function AdminMfaBootstrap() {
  const [stage, setStage] = useState<Stage>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const sendCode = () =>
    startTransition(async () => {
      setError(null)
      const { error: sendError } =
        await getSupabaseBrowserClient().auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false },
        })
      if (sendError) {
        setError("Could not send the administrator sign-in code.")
        return
      }
      setStage("code")
    })

  const verifyCode = () =>
    startTransition(async () => {
      setError(null)
      const { error: verifyError } =
        await getSupabaseBrowserClient().auth.verifyOtp({
          email: email.trim(),
          token: code.replace(/\s+/g, ""),
          type: "email",
        })
      if (verifyError) {
        setError("That sign-in code was not accepted.")
        return
      }

      const authorisation = await fetch("/api/admin-mfa-bootstrap/authorize", {
        method: "POST",
      })
      if (!authorisation.ok) {
        setError("This account is not eligible for administrator MFA setup.")
        return
      }
      setStage("ready")
    })

  const register = () =>
    startTransition(async () => {
      setError(null)
      const result = await registerAdminWebAuthnFactor(
        getSupabaseBrowserClient()
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStage("complete")
    })

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <section className="surface-card w-full max-w-md space-y-4 p-6">
        <Eyebrow>Protected administrator setup</Eyebrow>
        <h1 className="text-3xl leading-tight font-extrabold">
          Set up your security key
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          This one-time path enrols a passkey or hardware security key without
          granting admin authority. A separate protected activation is still
          required.
        </p>

        {stage === "email" ? (
          <div className="space-y-3">
            <label htmlFor="bootstrap-email" className="text-sm font-semibold">
              Administrator email
            </label>
            <Input
              id="bootstrap-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button
              type="button"
              disabled={pending || !email.trim()}
              onClick={sendCode}
            >
              {pending ? "Sending…" : "Send sign-in code"}
            </Button>
          </div>
        ) : null}

        {stage === "code" ? (
          <div className="space-y-3">
            <label htmlFor="bootstrap-code" className="text-sm font-semibold">
              Email sign-in code
            </label>
            <Input
              id="bootstrap-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button
              type="button"
              disabled={pending || code.replace(/\s+/g, "").length !== 6}
              onClick={verifyCode}
            >
              {pending ? "Checking…" : "Verify sign-in code"}
            </Button>
          </div>
        ) : null}

        {stage === "ready" ? (
          <Button type="button" disabled={pending} onClick={register}>
            {pending ? "Waiting for your device…" : "Register security key"}
          </Button>
        ) : null}

        {stage === "complete" ? (
          <p role="status" className="text-sm leading-6">
            The security key is verified and awaiting independent activation.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  )
}
