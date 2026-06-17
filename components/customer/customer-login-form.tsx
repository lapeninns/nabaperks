"use client"

import { useActionState } from "react"

import {
  requestCustomerLoginOtpAction,
  verifyCustomerLoginOtpAction,
  type CustomerLoginOtpState,
} from "@/app/home/actions"
import { customerInputClass } from "@/components/customer/input-class"
import { Button } from "@/components/ui/button"

const initialState: CustomerLoginOtpState = {}

type CustomerLoginFormProps = {
  readonly next: string
}

export function CustomerLoginForm({ next }: CustomerLoginFormProps) {
  const [state, requestAction, requestPending] = useActionState(
    requestCustomerLoginOtpAction,
    initialState
  )
  const [, verifyAction, verifyPending] = useActionState(
    verifyCustomerLoginOtpAction,
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
            className={customerInputClass}
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
          <div className="grid gap-1 rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
            <p>{state.message}</p>
            <p className="text-xs leading-5">
              If it does not arrive, check the number and resend the code.
            </p>
          </div>
        ) : null}
        <Button type="submit" disabled={requestPending}>
          {requestPending
            ? "Sending..."
            : otpSent
              ? "Resend code"
              : "Send code"}
        </Button>
      </form>

      {otpSent ? (
        <form action={verifyAction} className="grid gap-4">
          <input
            type="hidden"
            name="contact"
            value={state.fields?.contact ?? ""}
          />
          <input type="hidden" name="next" value={next} />
          <div className="grid gap-2">
            <label htmlFor="otp" className="eyebrow">
              Phone code
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${customerInputClass} font-mono`}
              aria-invalid={Boolean(state.errors?.otp)}
            />
            {state.errors?.otp ? (
              <p className="text-sm text-destructive">{state.errors.otp}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={verifyPending}>
            {verifyPending ? "Checking..." : "Open my cards"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
