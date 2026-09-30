"use client"

import { useActionState } from "react"

import {
  profilePhoneAction,
  type ProfilePhoneState,
} from "@/app/home/(authed)/profile/phone-actions"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { WalletLinkNextStep } from "@/components/customer/wallet-link-next-step"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Field, FieldGroup } from "@/components/ui/field"
import { useOtpRetryCountdown } from "@/hooks/use-otp-retry-countdown"
import {
  OTP_SEND_LABEL,
  OTP_TEXT_FALLBACK_LABEL,
} from "@/lib/customer/otp-channel-core"
import {
  phoneCodeResendAt,
  resendWaiting,
  sendNewCodeLabel,
} from "@/lib/customer/otp-resend"
import {
  PREVIOUS_STAMPS_COPY,
  STAMPS_TOGETHER_HEADLINE,
  walletLinkReturnTo,
} from "@/lib/customer/previous-stamps"

const ADD_PHONE_HINT = "We'll send you a code to confirm it's you."

type ProfilePhoneAction = (
  state: ProfilePhoneState,
  data: FormData
) => Promise<ProfilePhoneState>

const initialState: ProfilePhoneState = { step: "phone" }

/**
 * `contact`: the mobile number this card is missing (Profile's Contact
 * section, the reward gate). `previous`: the "Find my previous stamps" task,
 * where the number is the one the guest used before. Both confirm the number
 * with the same code and bring a complementary card's stamps here once its
 * ownership is proven; only the words differ.
 */
export type AddPhoneVariant = "contact" | "previous"

const VARIANT_COPY: Record<
  AddPhoneVariant,
  { readonly title: string; readonly body: string }
> = {
  contact: {
    title: "Add your mobile number",
    body: "You'll need it to collect rewards, and to sign in on another phone.",
  },
  previous: {
    title: PREVIOUS_STAMPS_COPY.phoneTitle,
    body: "Enter the number you used before. We'll send it a code.",
  },
}

/**
 * "Add your mobile number", for a signed-in card that has none (it was
 * started with an email). The number is confirmed with a code before it is
 * added, and a complementary card is brought together after ownership is
 * proved.
 *
 * The profile keeps it mounted whatever the card holds: adding a phone
 * re-renders the page with `hasPhone`, and the form must stay long enough to
 * show that the number was added. Otherwise a card with a phone sees
 * nothing here. The reward gate passes `returnTo` (the reward), which the
 * action uses to come back with a notice once the gate moves on.
 */
export function CustomerProfileAddPhone({
  action = profilePhoneAction,
  hasPhone = false,
  variant = "contact",
  returnTo,
}: {
  action?: ProfilePhoneAction
  hasPhone?: boolean
  variant?: AddPhoneVariant
  /** Where "Sign in again" and the reward gate's notice return to. */
  returnTo?: string
}) {
  const [state, submitAction, pending] = useActionState(action, initialState)
  if (hasPhone && state.step !== "attached") return null
  const target = returnTo ? walletLinkReturnTo(returnTo) : undefined

  // Once added, only the confirmation: the invitation to add a phone no
  // longer describes this card.
  if (state.step === "attached") {
    return (
      <div
        className="grid gap-1 rounded-lg border-2 border-dashed border-border p-4"
        data-add-phone={variant}
      >
        <h3 className="text-base font-extrabold">
          {state.walletLinked
            ? STAMPS_TOGETHER_HEADLINE
            : "Mobile number confirmed"}
        </h3>
        <p role="status" className="text-sm leading-6">
          {state.message}
        </p>
        <WalletLinkNextStep linked={state.walletLinked} returnTo={target} />
      </div>
    )
  }

  const copy = VARIANT_COPY[variant]
  const idPrefix = variant === "previous" ? "previous-phone" : "add-phone"
  return (
    <div
      className="grid gap-3 rounded-lg border-2 border-dashed border-border p-4"
      data-add-phone={variant}
    >
      <div className="grid gap-1">
        <h3 className="text-base font-extrabold">{copy.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{copy.body}</p>
      </div>
      {state.step === "code" ? (
        <PhoneCodeForm
          state={state}
          submitAction={submitAction}
          pending={pending}
          returnTo={target}
          idPrefix={idPrefix}
          variant={variant}
        />
      ) : (
        <PhoneNumberForm
          state={state}
          submitAction={submitAction}
          pending={pending}
          idPrefix={idPrefix}
        />
      )}
      <WalletLinkNextStep recovery={state.recovery} returnTo={target} />
    </div>
  )
}

type StepProps = {
  state: ProfilePhoneState
  submitAction: (data: FormData) => void
  pending: boolean
}

function PhoneNumberForm({
  state,
  submitAction,
  pending,
  idPrefix,
}: StepProps & { idPrefix: string }) {
  const phoneError = state.errors?.phone
  const inputId = idPrefix
  const errorId = `${idPrefix}-error`
  const hintId = `${idPrefix}-hint`
  return (
    <form action={submitAction}>
      <input type="hidden" name="intent" value="request" />
      <FieldGroup className="gap-3">
        <Field className="gap-2" data-invalid={Boolean(phoneError)}>
          <label htmlFor={inputId} className="eyebrow">
            UK mobile number
          </label>
          <input
            id={inputId}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07700 900123"
            defaultValue={state.phone ?? ""}
            className={customerInputClass}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? errorId : hintId}
          />
          {phoneError ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {phoneError}
            </p>
          ) : (
            <p id={hintId} className="text-xs leading-5 text-muted-foreground">
              {ADD_PHONE_HINT}
            </p>
          )}
        </Field>
        {state.errors?.form ? (
          <StatusBanner tone="error" title={state.errors.form} />
        ) : null}
        <SubmitButton
          variant="secondary"
          className="w-full"
          disabled={pending}
          pendingLabel="Sending…"
        >
          {OTP_SEND_LABEL}
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}

function PhoneCodeForm({
  state,
  submitAction,
  pending,
  returnTo,
  idPrefix,
  variant,
}: StepProps & {
  returnTo?: string
  idPrefix: string
  variant: AddPhoneVariant
}) {
  const otpId = `${idPrefix}-otp`
  const phone = state.phone ?? ""
  const codeError = state.errors?.otp
  // As on the join code step: a text is offered only when the code went out
  // on WhatsApp; if it already went by text, WhatsApp refused the number.
  const offersText = state.channel === "whatsapp"
  // A new code after a short wait from the latest send, as on the join and
  // sign-in code steps; the server still admits each send.
  const resendCountdown = useOtpRetryCountdown(
    phoneCodeResendAt(state.codeSentAt)
  )
  const waiting = resendWaiting(resendCountdown)
  return (
    <div className="grid gap-3">
      <form action={submitAction}>
        <input type="hidden" name="intent" value="verify" />
        {/* Echoed back if the code has lapsed, so the number stays filled. */}
        <input type="hidden" name="phone" value={phone} />
        {returnTo ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}
        <input type="hidden" name="task" value={variant} />
        <FieldGroup className="gap-3">
          <Field className="gap-2" data-invalid={Boolean(codeError)}>
            <label htmlFor={otpId} className="eyebrow">
              Your code
            </label>
            <CustomerOtpInput
              id={otpId}
              name="otp"
              autoFocus
              className={`${customerInputClass} font-mono`}
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? `${otpId}-error` : `${otpId}-hint`}
            />
            {codeError ? (
              <p
                id={`${otpId}-error`}
                role="alert"
                className="text-sm text-destructive"
              >
                {codeError}
              </p>
            ) : (
              <p
                id={`${otpId}-hint`}
                className="text-xs leading-5 text-muted-foreground"
              >
                Paste or type the code from the message.
              </p>
            )}
          </Field>
          {state.errors?.form ? (
            <StatusBanner tone="error" title={state.errors.form} />
          ) : null}
          <SubmitButton
            className="w-full"
            disabled={pending}
            pendingLabel="Checking…"
          >
            Continue
          </SubmitButton>
        </FieldGroup>
      </form>
      <div className="grid gap-1.5">
        <form
          action={submitAction}
          className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"
        >
          <input type="hidden" name="intent" value="request" />
          <input type="hidden" name="resend" value="1" />
          <input type="hidden" name="phone" value={phone} />
          {state.channel ? (
            <input type="hidden" name="channel" value={state.channel} />
          ) : null}
          <p className="text-sm text-muted-foreground">
            Sent to the number ending{" "}
            <span className="font-bold text-foreground tabular-nums">
              {phone.slice(-4)}
            </span>
          </p>
          <SubmitButton
            variant="link"
            size="xs"
            className="tabular-nums"
            disabled={pending || waiting}
            pendingLabel="Sending…"
          >
            {sendNewCodeLabel(resendCountdown)}
          </SubmitButton>
        </form>
        {offersText ? (
          <form action={submitAction}>
            <input type="hidden" name="intent" value="request" />
            <input type="hidden" name="resend" value="1" />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="channel" value="sms" />
            <SubmitButton
              variant="link"
              size="xs"
              className="h-auto min-h-11 justify-start px-0"
              disabled={pending || waiting}
              pendingLabel="Sending…"
            >
              {OTP_TEXT_FALLBACK_LABEL}
            </SubmitButton>
          </form>
        ) : null}
        <form action={submitAction}>
          <input type="hidden" name="intent" value="edit" />
          <input type="hidden" name="phone" value={phone} />
          <SubmitButton
            variant="link"
            size="xs"
            className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
            disabled={pending}
            pendingLabel="Changing number…"
          >
            Wrong number? Change it
          </SubmitButton>
        </form>
        <p
          role="status"
          aria-live="polite"
          className="text-xs leading-5 text-muted-foreground"
        >
          {pending ? undefined : state.message}
        </p>
      </div>
    </div>
  )
}
