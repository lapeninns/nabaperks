"use client"

import type { CustomerLoginStepProps } from "@/components/customer/customer-login-method-switch"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { CustomerLoginScanStep } from "@/components/customer/customer-login-scan-step"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Field, FieldGroup } from "@/components/ui/field"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { JOIN_PHONE_CODE_HINT } from "@/lib/customer/experience/copy"

/**
 * /home/login by phone: the number, then the code from the message. A code
 * only opens a wallet the number already holds; the request answer is the
 * same whether or not one does.
 */
export function CustomerLoginPhoneStep(props: CustomerLoginStepProps) {
  const { state } = props
  const editingContact = Boolean(state.fields?.editingContact)
  const noCards = Boolean(state.fields?.noCards) && !editingContact
  const otpSent = Boolean(state.fields?.otpSent) && !editingContact
  if (noCards) return <PhoneScanStep {...props} />
  return otpSent ? (
    <PhoneCodeStep {...props} />
  ) : (
    <PhoneRequestStep {...props} />
  )
}

/**
 * The code was valid and the number has no cards. Point at the venue QR
 * instead of offering another code, so a new visitor stops requesting texts.
 */
function PhoneScanStep({
  state,
  submitAction,
  pending,
}: CustomerLoginStepProps) {
  const contact = state.fields?.contact ?? ""
  return (
    <CustomerLoginScanStep message={pending ? undefined : state.message}>
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
    </CustomerLoginScanStep>
  )
}

function PhoneCodeStep({
  state,
  submitAction,
  pending,
  next,
  onVerifySubmit,
}: CustomerLoginStepProps) {
  const contact = state.fields?.contact ?? ""
  const verifyError = state.errors?.otp ?? state.errors?.form
  const message = pending ? undefined : state.message

  return (
    <div className="grid gap-4">
      <form action={submitAction} onSubmit={onVerifySubmit}>
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
  )
}

function PhoneRequestStep({
  state,
  submitAction,
  pending,
  alternate,
}: CustomerLoginStepProps) {
  const editingContact = Boolean(state.fields?.editingContact)
  const contact = state.fields?.contact ?? ""
  const contactError = editingContact ? undefined : state.errors?.contact
  const message = editingContact || pending ? undefined : state.message

  return (
    <div className="grid gap-3">
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
              aria-describedby={contactError ? "contact-error" : "contact-hint"}
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
      {alternate}
    </div>
  )
}
