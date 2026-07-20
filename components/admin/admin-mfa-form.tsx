"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { AuthField } from "@/components/auth/auth-field"
import { Eyebrow } from "@/components/brand"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

type MfaPhase = "loading" | "enroll" | "verify"

type TotpFactor = {
  readonly id: string
  readonly qrCode?: string
  readonly secret?: string
}

export function AdminMfaForm({
  email,
  next,
}: {
  readonly email: string
  readonly next: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [phase, setPhase] = useState<MfaPhase>("loading")
  const [factor, setFactor] = useState<TotpFactor | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function prepareFactor() {
      setError(null)
      const { data: factors, error: listError } =
        await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (listError) {
        setError(listError.message)
        return
      }

      const verified = factors?.totp?.find((item) => item.status === "verified")
      if (verified) {
        setFactor({ id: verified.id })
        setPhase("verify")
        return
      }

      const { data: enrollment, error: enrollError } =
        await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (cancelled) return
      if (enrollError) {
        setError(enrollError.message)
        return
      }

      setFactor({
        id: enrollment.id,
        qrCode: enrollment.totp?.qr_code,
        secret: enrollment.totp?.secret,
      })
      setPhase("enroll")
    }

    void prepareFactor()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!factor) return

    setPending(true)
    setError(null)

    const normalizedCode = code.replace(/\s+/g, "")
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challengeError) {
      setError(challengeError.message)
      setPending(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: normalizedCode,
    })
    if (verifyError) {
      setError(verifyError.message)
      setPending(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <Eyebrow>Internal admin</Eyebrow>
        <h1 className="text-2xl leading-tight font-extrabold">
          Verify with authenticator
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Signed in as {email}. Add a one-time code from your authenticator app
          to open the admin console.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {phase === "loading" ? (
        <p className="text-sm text-muted-foreground">Preparing MFA…</p>
      ) : null}

      {phase === "enroll" && factor?.qrCode ? (
        <div className="grid gap-3 rounded-md border-2 border-dashed border-border bg-background p-4">
          <p className="text-sm font-semibold">Scan this QR in your app</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase TOTP QR is an inline data URL */}
          <img
            src={factor.qrCode}
            alt="Authenticator QR code"
            width={180}
            height={180}
            className="mx-auto rounded-md border border-border bg-white p-2"
          />
          {factor.secret ? (
            <p className="mono-id text-center text-muted-foreground">
              Manual key: {factor.secret}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase !== "loading" ? (
        <form className="grid gap-4" onSubmit={verifyCode}>
          <AuthField
            id="admin-mfa-code"
            name="code"
            label="Authenticator code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="6-digit code"
            maxLength={8}
            required
          />
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? (
              <>
                <Spinner aria-hidden="true" role="presentation" />
                Verifying…
              </>
            ) : phase === "enroll" ? (
              "Verify and open admin"
            ) : (
              "Verify code"
            )}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
