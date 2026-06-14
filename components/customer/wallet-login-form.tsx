"use client"

import { useActionState } from "react"

import {
  requestWalletOtpAction,
  verifyWalletOtpAction,
  type WalletOtpState,
} from "@/app/wallet/actions"
import { Button } from "@/components/ui/button"

const initialState: WalletOtpState = {}

export function WalletLoginForm() {
  const [state, requestAction, requestPending] = useActionState(
    requestWalletOtpAction,
    initialState
  )
  const [, verifyAction, verifyPending] = useActionState(
    verifyWalletOtpAction,
    initialState
  )

  const otpSent = state.fields?.otpSent

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor="contact" className="eyebrow">
            Phone number
          </label>
          <input
            id="contact"
            name="contact"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07400 123456"
            defaultValue={state.fields?.contact}
            className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
            aria-invalid={Boolean(state.errors?.contact)}
            aria-describedby={
              state.errors?.contact ? "contact-error" : undefined
            }
          />
          {state.errors?.contact ? (
            <p id="contact-error" className="text-sm text-destructive">
              {state.errors.contact}
            </p>
          ) : null}
        </div>
        {state.errors?.form ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        {state.message ? (
          <p className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" disabled={requestPending || otpSent}>
          {requestPending ? "Sending..." : otpSent ? "Code sent" : "Send code"}
        </Button>
      </form>

      {otpSent ? (
        <form action={verifyAction} className="grid gap-4">
          <input
            type="hidden"
            name="contact"
            value={state.fields?.contact ?? ""}
          />
          <div className="grid gap-2">
            <label htmlFor="otp" className="eyebrow">
              Phone code
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 font-mono text-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
              aria-invalid={Boolean(state.errors?.otp)}
            />
            {state.errors?.otp ? (
              <p className="text-sm text-destructive">{state.errors.otp}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={verifyPending}>
            {verifyPending ? "Checking..." : "Open wallet"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
