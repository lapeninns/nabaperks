"use client"

import { useActionState } from "react"

import {
  previousStampsEmailAction,
  type EmailPromptState,
} from "@/app/home/(authed)/profile/actions"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { customerInputClass } from "@/components/customer/input-class"
import { WalletLinkNextStep } from "@/components/customer/wallet-link-next-step"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Field, FieldGroup } from "@/components/ui/field"
import {
  PREVIOUS_STAMPS_COPY,
  STAMPS_TOGETHER_HEADLINE,
} from "@/lib/customer/previous-stamps"

type PreviousStampsEmailAction = (
  state: EmailPromptState,
  data: FormData
) => Promise<EmailPromptState>

const initialState: EmailPromptState = { step: "email" }
const COPY = PREVIOUS_STAMPS_COPY

/**
 * "Find my previous stamps" for a card with a confirmed mobile number and no
 * confirmed email: the other email, then its code. Proving it brings a
 * complementary card's stamps here on the server; nothing about that card is
 * shown before then, and a refusal says only what the guest can do next.
 */
export function CustomerProfilePreviousStampsEmail({
  action = previousStampsEmailAction,
  returnTo,
}: {
  action?: PreviousStampsEmailAction
  returnTo?: string
}) {
  const [state, submitAction, pending] = useActionState(action, initialState)
  const verified = state.step === "verified"
  // One status line that stays mounted across the steps and starts empty, so
  // "code sent" and the confirmation are announced when they arrive, not
  // inserted already filled (which most screen readers skip).
  const status = pending
    ? ""
    : verified
      ? (state.message ?? COPY.nothingFound.email)
      : (state.message ?? "")

  return (
    <div
      className="grid gap-3"
      data-previous-stamps-result={verified ? "" : undefined}
    >
      <h3 className="text-base font-extrabold">
        {verified
          ? state.walletLinked
            ? STAMPS_TOGETHER_HEADLINE
            : "Email confirmed"
          : COPY.emailTitle}
      </h3>
      <p
        id="previous-stamps-email-status"
        role="status"
        aria-live="polite"
        className={verified ? "text-sm leading-6" : "text-xs leading-5"}
      >
        {status}
      </p>
      {verified ? (
        <WalletLinkNextStep linked={state.walletLinked} returnTo={returnTo} />
      ) : (
        <>
          {state.step === "code" ? (
            <EmailCodeForm
              state={state}
              submitAction={submitAction}
              pending={pending}
            />
          ) : (
            <EmailAddressForm
              state={state}
              submitAction={submitAction}
              pending={pending}
            />
          )}
          <WalletLinkNextStep recovery={state.recovery} returnTo={returnTo} />
        </>
      )}
    </div>
  )
}

type StepProps = {
  state: EmailPromptState
  submitAction: (data: FormData) => void
  pending: boolean
}

function EmailAddressForm({ state, submitAction, pending }: StepProps) {
  const emailError = state.errors?.email
  return (
    <form action={submitAction}>
      <input type="hidden" name="intent" value="request" />
      <FieldGroup className="gap-3">
        <Field className="gap-2" data-invalid={Boolean(emailError)}>
          <label htmlFor="previous-stamps-email" className="eyebrow">
            {COPY.emailLabel}
          </label>
          <input
            id="previous-stamps-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.email ?? ""}
            className={customerInputClass}
            aria-invalid={Boolean(emailError)}
            aria-describedby={
              emailError ? "previous-stamps-email-error" : undefined
            }
          />
          {emailError ? (
            <p
              id="previous-stamps-email-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {emailError}
            </p>
          ) : null}
        </Field>
        {state.errors?.form ? (
          <StatusBanner tone="warning" title={state.errors.form} />
        ) : null}
        <SubmitButton
          variant="secondary"
          className="w-full"
          disabled={pending}
          pendingLabel="Sending…"
        >
          {COPY.emailSend}
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}

function EmailCodeForm({ state, submitAction, pending }: StepProps) {
  const codeError = state.errors?.otp
  return (
    <div className="grid gap-3">
      <form action={submitAction}>
        <input type="hidden" name="intent" value="verify" />
        <FieldGroup className="gap-3">
          <Field className="gap-2" data-invalid={Boolean(codeError)}>
            <label htmlFor="previous-stamps-otp" className="eyebrow">
              {COPY.codeLabel}
            </label>
            <CustomerOtpInput
              id="previous-stamps-otp"
              name="otp"
              autoFocus
              className={`${customerInputClass} font-mono`}
              aria-invalid={Boolean(codeError)}
              // The "code sent" line is read with the field it is about.
              aria-describedby={
                codeError
                  ? "previous-stamps-otp-error"
                  : "previous-stamps-email-status"
              }
            />
            {codeError ? (
              <p
                id="previous-stamps-otp-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {codeError}
              </p>
            ) : null}
          </Field>
          {state.errors?.form ? (
            <StatusBanner tone="warning" title={state.errors.form} />
          ) : null}
          <SubmitButton
            className="w-full"
            disabled={pending}
            pendingLabel="Checking…"
          >
            {COPY.codeContinue}
          </SubmitButton>
        </FieldGroup>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={submitAction}>
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="email" value={state.email ?? ""} />
          <SubmitButton
            variant="link"
            size="xs"
            disabled={pending}
            pendingLabel="Sending…"
          >
            {COPY.resend}
          </SubmitButton>
        </form>
        <form action={submitAction}>
          <input type="hidden" name="intent" value="change" />
          <SubmitButton
            variant="link"
            size="xs"
            disabled={pending}
            pendingLabel="Changing…"
          >
            {COPY.changeEmail}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
