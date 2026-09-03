"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  resendCustomerAccessRecoveryAction,
  type CustomerAccessRecoveryState,
  verifyCustomerAccessRecoveryAction,
} from "@/app/home/recover/actions"
import { customerInputClass } from "@/components/customer/input-class"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const initialState: CustomerAccessRecoveryState = {}

export function CustomerAccessRecoveryForm({
  canUseEmail,
}: {
  canUseEmail: boolean
}) {
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCustomerAccessRecoveryAction,
    initialState
  )
  const [resendState, resendAction, resendPending] = useActionState(
    resendCustomerAccessRecoveryAction,
    initialState
  )
  const formError = verifyState.errors?.form ?? resendState.errors?.form

  if (!canUseEmail) {
    return (
      <div className="grid gap-4">
        <StatusBanner
          tone="error"
          title="We can't safely open this existing wallet on a new device because it has no verified recovery email."
        />
        <p className="text-sm leading-6 text-muted-foreground">
          Use a browser where you have opened this wallet before. We will not
          create a replacement wallet or move the previous customer&apos;s
          cards.
        </p>
        <Button asChild>
          <Link href="/home/login">Try another phone number</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        We sent a six-digit code to the verified email already on this account.
        Enter it to prove this wallet belongs to you. We do not show the address
        here.
      </p>
      <form action={verifyAction} className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor="recovery-code" className="eyebrow">
            Email code
          </label>
          <input
            id="recovery-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            className={`${customerInputClass} font-mono`}
            aria-invalid={Boolean(verifyState.errors?.code)}
            aria-describedby={
              verifyState.errors?.code ? "recovery-code-error" : undefined
            }
          />
          {verifyState.errors?.code ? (
            <p
              id="recovery-code-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {verifyState.errors.code}
            </p>
          ) : null}
        </div>
        {formError ? <StatusBanner tone="error" title={formError} /> : null}
        {resendState.message ? (
          <p role="status" className="text-sm leading-6 font-semibold">
            {resendState.message}
          </p>
        ) : null}
        <Button type="submit" disabled={verifyPending}>
          {verifyPending ? "Checking…" : "Open my wallet"}
        </Button>
      </form>
      <form action={resendAction}>
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={resendPending}
        >
          {resendPending ? "Sending…" : "Send a fresh email code"}
        </Button>
      </form>
      <Link
        href="/home/login"
        className="text-center text-xs font-bold underline underline-offset-4"
      >
        Start again with a different phone
      </Link>
    </div>
  )
}
