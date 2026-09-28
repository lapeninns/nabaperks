"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { submitCustomerLoginOtpAction } from "@/app/home/login/otp-action"
import { ReceiptCard, VenueMark } from "@/components/brand"
import { useRememberContactMethodOnVerify } from "@/components/customer/contact-method-order"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup } from "@/components/ui/field"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { JOIN_PHONE_CODE_HINT } from "@/lib/customer/experience/copy"

type LoginAction = (
  state: CustomerLoginOtpState,
  data: FormData
) => Promise<CustomerLoginOtpState>

type CustomerLoginFormProps = {
  readonly next: string
  readonly loginAction?: LoginAction
}

export function CustomerLoginForm({
  next,
  loginAction = submitCustomerLoginOtpAction,
}: CustomerLoginFormProps) {
  const [state, submitAction, pending] = useActionState(loginAction, {})
  const editingContact = Boolean(state.fields?.editingContact)
  const contact = state.fields?.contact ?? ""
  const noCards = Boolean(state.fields?.noCards) && !editingContact
  const otpSent = Boolean(state.fields?.otpSent) && !editingContact && !noCards
  const contactError = editingContact ? undefined : state.errors?.contact
  const verifyError = state.errors?.otp ?? state.errors?.form
  const message = editingContact || pending ? undefined : state.message
  // A phone sign-in here makes the join page lead with phone next time (D12).
  const rememberPhone = useRememberContactMethodOnVerify("phone", state)

  return (
    <ReceiptCard edge className="grid min-w-0 gap-6 short:gap-4">
      <div className="grid justify-items-center gap-3 text-center">
        <VenueMark
          size={otpSent ? 40 : 56}
          name="Nabaperks"
          caption="My Nabaperks"
        />
        <div className="grid gap-1">
          <h1 className="text-2xl leading-tight font-extrabold text-balance">
            {noCards
              ? "No cards on this number"
              : otpSent
                ? "Enter your code"
                : "Welcome back"}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {noCards
              ? "Scan the venue QR at the counter. Your first card is created there."
              : otpSent
                ? "Use the code from your message to open your cards."
                : "Sign in to see every loyalty card you've collected, track your rewards, and pick up where you left off."}
          </p>
        </div>
      </div>

      {noCards ? (
        <div className="grid gap-4">
          <p role="status" className="text-sm leading-6">
            {message}
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/scan">Scan a venue QR</Link>
          </Button>
          <form action={submitAction}>
            <input type="hidden" name="intent" value="edit" />
            <input type="hidden" name="contact" value={contact} />
            <SubmitButton
              variant="link"
              size="xs"
              className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
              disabled={pending}
              pendingLabel="Changing number…"
            >
              Use a different number
            </SubmitButton>
          </form>
        </div>
      ) : otpSent ? (
        <div className="grid gap-4">
          <form action={submitAction} onSubmit={rememberPhone}>
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="contact" value={contact} />
            <input type="hidden" name="next" value={next} />
            <FieldGroup className="gap-4">
              <Field className="gap-2" data-invalid={Boolean(verifyError)}>
                <label htmlFor="otp" className="eyebrow">
                  Phone code
                </label>
                <CustomerOtpInput
                  id="otp"
                  name="otp"
                  autoFocus
                  className={`${customerInputClass} font-mono`}
                  aria-invalid={Boolean(verifyError)}
                  aria-describedby={verifyError ? "otp-error" : "otp-hint"}
                />
                {verifyError ? (
                  <p
                    id="otp-error"
                    role="alert"
                    aria-live="assertive"
                    className="text-sm text-destructive"
                  >
                    {verifyError}
                  </p>
                ) : (
                  <p
                    id="otp-hint"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    Paste or type the code from the message.
                  </p>
                )}
              </Field>
              <SubmitButton
                size="lg"
                className="w-full"
                disabled={pending}
                pendingLabel="Checking…"
              >
                {OPEN_MY_CARDS_LABEL}
              </SubmitButton>
            </FieldGroup>
          </form>

          <div className="grid gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-2.5">
            <form
              action={submitAction}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"
            >
              <input type="hidden" name="intent" value="request" />
              <input type="hidden" name="contact" value={contact} />
              <p className="text-sm text-muted-foreground">
                Phone ending{" "}
                <span className="font-bold text-foreground tabular-nums">
                  {contact.slice(-4)}
                </span>
              </p>
              <SubmitButton
                variant="link"
                size="xs"
                disabled={pending}
                pendingLabel="Sending…"
              >
                Resend code
              </SubmitButton>
            </form>
            <form action={submitAction}>
              <input type="hidden" name="intent" value="edit" />
              <input type="hidden" name="contact" value={contact} />
              <SubmitButton
                variant="link"
                size="xs"
                className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
                disabled={pending}
                pendingLabel="Changing number…"
              >
                Wrong number? Use a different one
              </SubmitButton>
            </form>
            <p
              role="status"
              aria-live="polite"
              className="text-xs leading-5 text-muted-foreground"
            >
              {message}
            </p>
          </div>
        </div>
      ) : (
        <form action={submitAction}>
          <input type="hidden" name="intent" value="request" />
          <FieldGroup className="gap-4">
            <Field className="gap-2" data-invalid={Boolean(contactError)}>
              <label htmlFor="contact" className="eyebrow">
                Phone number
              </label>
              <input
                id="contact"
                name="contact"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus={editingContact}
                placeholder="07400 123456"
                defaultValue={contact}
                className={customerInputClass}
                aria-invalid={Boolean(contactError)}
                aria-describedby={
                  contactError ? "contact-error" : "contact-hint"
                }
              />
              {contactError ? (
                <p
                  id="contact-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {contactError}
                </p>
              ) : (
                <p
                  id="contact-hint"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  {JOIN_PHONE_CODE_HINT}
                </p>
              )}
            </Field>
            {!editingContact && state.errors?.form ? (
              <StatusBanner tone="error" title={state.errors.form} />
            ) : null}
            {message ? (
              <p role="status" className="text-sm leading-6">
                {message}
              </p>
            ) : null}
            <SubmitButton
              size="lg"
              className="w-full"
              disabled={pending}
              pendingLabel="Sending…"
            >
              Send code
            </SubmitButton>
          </FieldGroup>
        </form>
      )}

      {noCards ? null : (
        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp —
          your first card is created automatically.
        </p>
      )}
    </ReceiptCard>
  )
}
