"use client"

import { useActionState, type ReactNode } from "react"

import {
  requestCustomerEmailIdentityAction,
  type CustomerEmailIdentityState,
} from "@/app/m/[merchantSlug]/join/email-actions"
import { customerInputClass } from "@/components/customer/input-class"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const emailInitialState: CustomerEmailIdentityState = {}

export type CustomerEmailFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  /** "Back to the text code" (or the number form), under the button. */
  alternate?: ReactNode
  /**
   * Mode `full`: that confirming the code starts a card for an address no
   * card uses. Shown before the code is sent, so sending is an informed
   * choice (the published terms: "after you choose to start one").
   */
  creationDisclosure?: string
}

/**
 * Join by email, the fallback for a phone code that has not arrived: one
 * field and one button. The code goes out by email, so it arrives over the
 * venue's Wi-Fi when there is no mobile signal. The answer is the same
 * whether or not a card uses the address; that is only said after the guest
 * proves the inbox is theirs.
 */
export function CustomerEmailForm({
  merchantSlug,
  qrId,
  referralCode,
  alternate,
  creationDisclosure,
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
            aria-describedby={[
              state.errors?.email ? "email-error" : "email-hint",
              creationDisclosure ? "email-new-card" : null,
            ]
              .filter(Boolean)
              .join(" ")}
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
              We&apos;ll email you a code to type on the next screen.
            </p>
          )}
          {creationDisclosure ? (
            <p
              id="email-new-card"
              className="text-xs leading-5 text-muted-foreground"
            >
              {creationDisclosure}
            </p>
          ) : null}
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
          {requestPending ? "Sending…" : "Send code by email"}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {requestPending ? "Sending your code" : ""}
        </p>
      </form>

      {alternate}
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
