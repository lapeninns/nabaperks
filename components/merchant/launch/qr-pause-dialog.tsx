"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Dialog } from "radix-ui"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  requestQrPauseCode,
  verifyQrPauseCode,
} from "@/app/app/qr/pause-actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  isQrPauseComplete,
  type QrPauseState,
} from "@/lib/merchant/qr-pause-state"

type PauseActions = {
  request: typeof requestQrPauseCode
  verify: typeof verifyQrPauseCode
}

export function QrPauseDialog({
  qrCodeId,
  venueName,
  actions = { request: requestQrPauseCode, verify: verifyQrPauseCode },
}: {
  qrCodeId: string
  venueName: string
  actions?: PauseActions
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline">
          Pause customer scans
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl border-2 border-ink bg-card p-6 text-card-foreground shadow-lg">
          <Dialog.Title className="text-xl font-extrabold">
            Pause customer scans at {venueName}?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            Pausing stops customers using this QR to join or collect stamps.
            Verify with a code sent to the owner’s sign-in email. Requesting a
            code leaves the QR unchanged.
          </Dialog.Description>
          {open && (
            <PauseForm
              qrCodeId={qrCodeId}
              actions={actions}
              pending={pending}
              startTransition={startTransition}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PauseForm({
  qrCodeId,
  actions,
  pending,
  startTransition,
}: {
  qrCodeId: string
  actions: PauseActions
  pending: boolean
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const router = useRouter()
  const [state, setState] = useState<QrPauseState>({
    status: "idle",
    message: "",
  })
  const [code, setCode] = useState("")
  const [seconds, setSeconds] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)
  const complete = isQrPauseComplete(state.status)

  useEffect(() => {
    if (!state.retryAt) return
    const update = () =>
      setSeconds(
        Math.max(0, Math.ceil((Date.parse(state.retryAt!) - Date.now()) / 1000))
      )
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [state.retryAt])

  useEffect(() => {
    if (!pending && state.challengeId && !complete) codeRef.current?.focus()
  }, [pending, state.challengeId, state.status, complete])

  async function sendCode() {
    try {
      const result = await actions.request(qrCodeId)
      setState(result)
      setCode("")
    } catch {
      setState({
        status: "failed",
        message: "Could not request a code. Scans are unchanged. Try again.",
      })
    }
  }

  async function verifyCode() {
    if (!state.challengeId) return
    try {
      const result = await actions.verify(qrCodeId, state.challengeId, code)
      setState((previous) => ({ ...previous, ...result }))
      if (isQrPauseComplete(result.status)) {
        toast.success(result.message)
        router.refresh()
      }
    } catch {
      setState((previous) => ({
        ...previous,
        status: "failed",
        message:
          "Could not confirm the result. Retry the same code or refresh Venue QR to check its status.",
      }))
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(verifyCode)
      }}
    >
      {state.challengeId && !complete && (
        <Field data-invalid={state.status === "incorrect"}>
          <FieldLabel htmlFor="qr-pause-code">
            Email verification code
          </FieldLabel>
          <Input
            ref={codeRef}
            id="qr-pause-code"
            name="qrPauseCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            aria-invalid={state.status === "incorrect"}
            aria-describedby="qr-pause-feedback qr-pause-recipient"
            disabled={pending}
          />
          <FieldDescription id="qr-pause-recipient">
            Sent to {state.maskedEmail}. Use the latest code within 10 minutes.
          </FieldDescription>
        </Field>
      )}
      <p
        id="qr-pause-feedback"
        role="status"
        aria-live="polite"
        className="text-sm"
      >
        {state.message}
      </p>
      {!complete && (
        <div className="flex flex-wrap gap-3">
          {state.challengeId && (
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending ? "Please wait…" : "Verify and pause"}
            </Button>
          )}
          <Button
            type="button"
            variant={state.challengeId ? "outline" : "default"}
            disabled={pending || seconds > 0}
            onClick={() => startTransition(sendCode)}
          >
            {seconds > 0
              ? `Resend in ${seconds}s`
              : state.challengeId
                ? "Resend code"
                : pending
                  ? "Sending…"
                  : "Send verification code"}
          </Button>
        </div>
      )}
      <Dialog.Close asChild>
        <Button type="button" variant="outline" disabled={pending}>
          {complete ? "Close" : "Cancel"}
        </Button>
      </Dialog.Close>
    </form>
  )
}
