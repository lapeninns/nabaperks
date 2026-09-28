"use client"

import Link from "next/link"
import { useActionState, type ReactNode } from "react"

import {
  requestCustomerEmailIdentityAction,
  startEmailWalletAction,
  switchJoinToPhoneAction,
  type CustomerEmailChoiceState,
  type CustomerEmailIdentityState,
} from "@/app/m/[merchantSlug]/join/email-actions"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  JOIN_EMAIL_WIFI_HINT,
  JOIN_PHONE_BACK_LABEL,
} from "@/lib/customer/experience/copy"
import { OTP_SEND_LABEL } from "@/lib/customer/otp-channel-core"

const emailInitialState: CustomerEmailIdentityState = {}
const choiceInitialState: CustomerEmailChoiceState = {}

export type CustomerEmailFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  /** "Use my phone number instead", directly under the button. */
  alternate?: ReactNode
  /** "What do I get?": the welcome step, or the venue page for a direct join. */
  backHref: string
}

/**
 * Join by email, the fallback for a text that has not arrived: one field and
 * one button. The code goes out by email, so it arrives over the venue's
 * Wi-Fi when there is no mobile signal. The answer is
 * the same whether or not a wallet uses the address; that is only said after
 * the customer proves the inbox is theirs.
 */
export function CustomerEmailForm({
  merchantSlug,
  qrId,
  referralCode,
  alternate,
  backHref,
}: CustomerEmailFormProps) {
  const [state, requestAction, requestPending] = useActionState(
    requestCustomerEmailIdentityAction,
    emailInitialState
  )

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        <JoinHiddenFields
          merchantSlug={merchantSlug}
          qrId={qrId}
          referralCode={referralCode}
        />
        <div className="grid gap-2">
          <label htmlFor="email" className="eyebrow">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="you@example.com"
            defaultValue={state.fields?.email}
            className={customerInputClass}
            aria-invalid={Boolean(state.errors?.email)}
            aria-describedby={
              state.errors?.email ? "email-error" : "email-hint"
            }
            onFocus={(event) =>
              event.currentTarget.scrollIntoView({ block: "center" })
            }
          />
          {state.errors?.email ? (
            <p
              id="email-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {state.errors.email}
            </p>
          ) : (
            <p
              id="email-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              {JOIN_EMAIL_WIFI_HINT}
            </p>
          )}
        </div>
        {state.errors?.form ? (
          <StatusBanner tone="error" title={state.errors.form} />
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={requestPending}
        >
          {requestPending ? "Sending…" : OTP_SEND_LABEL}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {requestPending ? "Sending your code" : ""}
        </p>
      </form>

      {alternate}

      <Link
        href={backHref}
        className="text-center text-xs font-bold underline underline-offset-4"
      >
        {JOIN_PHONE_BACK_LABEL}
      </Link>
    </div>
  )
}

export type CustomerEmailChoiceFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  maskedEmail: string
  /** Mode `full` only: otherwise the new-wallet choice is not offered. */
  canCreate: boolean
  /** "Use a different email": the email step, where a pending code is ignored. */
  differentEmailHref: string
}

/**
 * The email is proven but no wallet holds it. Nothing has been created yet:
 * the customer says whether they are new here or joined before with a phone
 * number. Neither answer is styled as the expected one, because a wrong guess
 * either way costs them their stamps.
 */
export function CustomerEmailChoiceForm({
  merchantSlug,
  qrId,
  referralCode,
  maskedEmail,
  canCreate,
  differentEmailHref,
}: CustomerEmailChoiceFormProps) {
  const [state, createAction] = useActionState(
    startEmailWalletAction,
    choiceInitialState
  )

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border-2 border-dashed border-border px-3 py-2.5 text-left text-sm">
        <span className="text-muted-foreground">Confirmed </span>
        <span className="font-bold break-all">{maskedEmail}</span>
      </p>
      {state.errors?.form ? (
        <StatusBanner tone="error" title={state.errors.form} />
      ) : null}
      <div className="grid gap-3">
        {canCreate ? (
          <form action={createAction} className="grid">
            <JoinHiddenFields
              merchantSlug={merchantSlug}
              qrId={qrId}
              referralCode={referralCode}
            />
            <SubmitButton
              variant="outline"
              size="lg"
              className="h-auto min-h-12 w-full py-3 whitespace-normal"
              pendingLabel="Starting your wallet…"
            >
              No, I&rsquo;m new here: start my wallet
            </SubmitButton>
          </form>
        ) : null}
        <form action={switchJoinToPhoneAction} className="grid">
          <JoinHiddenFields
            merchantSlug={merchantSlug}
            qrId={qrId}
            referralCode={referralCode}
          />
          <SubmitButton
            variant="outline"
            size="lg"
            className="h-auto min-h-12 w-full py-3 whitespace-normal"
            pendingLabel="Opening…"
          >
            {canCreate
              ? "Yes, with my phone number: use my phone"
              : "Use my phone instead"}
          </SubmitButton>
        </form>
      </div>
      <Link
        href={differentEmailHref}
        className="focus-ring inline-flex min-h-11 w-fit items-center justify-self-center text-xs font-bold underline underline-offset-4"
      >
        Use a different email
      </Link>
    </div>
  )
}

/** The join context every email form posts. */
export function JoinHiddenFields({
  merchantSlug,
  qrId,
  referralCode,
}: {
  merchantSlug: string
  qrId?: string
  referralCode?: string
}) {
  return (
    <>
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="qrId" value={qrId ?? ""} />
      <input type="hidden" name="ref" value={referralCode ?? ""} />
    </>
  )
}
