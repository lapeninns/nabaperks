"use client"

import { useActionState } from "react"

import {
  profilePhoneAction,
  type ProfilePhoneState,
} from "@/app/home/(authed)/profile/phone-actions"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Field, FieldGroup } from "@/components/ui/field"
import { JOIN_PHONE_CODE_HINT } from "@/lib/customer/experience/copy"
import {
  OTP_SEND_LABEL,
  OTP_TEXT_FALLBACK_LABEL,
} from "@/lib/customer/otp-channel-core"

type ProfilePhoneAction = (
  state: ProfilePhoneState,
  data: FormData
) => Promise<ProfilePhoneState>

const initialState: ProfilePhoneState = { step: "phone" }

/**
 * "Add a phone number", for a signed-in wallet that has none (it was started
 * with an email). The number is confirmed with a code before it is added, and
 * a number another wallet holds is refused with a way to get help.
 *
 * The profile keeps it mounted whatever the wallet holds: adding a phone
 * re-renders the page with `hasPhone`, and the form must stay long enough to
 * show that the number was added. Otherwise a wallet with a phone sees
 * nothing here.
 */
export function CustomerProfileAddPhone({
  action = profilePhoneAction,
  hasPhone = false,
}: {
  action?: ProfilePhoneAction
  hasPhone?: boolean
}) {
  const [state, submitAction, pending] = useActionState(action, initialState)
  if (hasPhone && state.step !== "attached") return null

  // Once added, only the confirmation: the invitation to add a phone no
  // longer describes this wallet.
  if (state.step === "attached") {
    return (
      <div
        className="grid gap-1 rounded-lg border-2 border-dashed border-border p-4"
        data-add-phone
      >
        <h3 className="text-base font-extrabold">Phone number added</h3>
        <p role="status" className="text-sm leading-6">
          {state.message}
        </p>
      </div>
    )
  }

  return (
    <div
      className="grid gap-3 rounded-lg border-2 border-dashed border-border p-4"
      data-add-phone
    >
      <div className="grid gap-1">
        <h3 className="text-base font-extrabold">Add a phone number</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Your wallet opens with your email. Add a phone number to sign in with
          a text code too. Some venue offers need a confirmed phone number.
        </p>
      </div>
      {state.step === "code" ? (
        <PhoneCodeForm
          state={state}
          submitAction={submitAction}
          pending={pending}
        />
      ) : (
        <PhoneNumberForm
          state={state}
          submitAction={submitAction}
          pending={pending}
        />
      )}
    </div>
  )
}

type StepProps = {
  state: ProfilePhoneState
  submitAction: (data: FormData) => void
  pending: boolean
}

function PhoneNumberForm({ state, submitAction, pending }: StepProps) {
  const phoneError = state.errors?.phone
  return (
    <form action={submitAction}>
      <input type="hidden" name="intent" value="request" />
      <FieldGroup className="gap-3">
        <Field className="gap-2" data-invalid={Boolean(phoneError)}>
          <label htmlFor="add-phone" className="eyebrow">
            Phone number
          </label>
          <input
            id="add-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07400 123456"
            defaultValue={state.phone ?? ""}
            className={customerInputClass}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? "add-phone-error" : "add-phone-hint"}
          />
          {phoneError ? (
            <p
              id="add-phone-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {phoneError}
            </p>
          ) : (
            <p
              id="add-phone-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              {JOIN_PHONE_CODE_HINT}
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

function PhoneCodeForm({ state, submitAction, pending }: StepProps) {
  const phone = state.phone ?? ""
  const codeError = state.errors?.otp
  // As on the join code step: a text is offered only when the code went out
  // on WhatsApp; if it already went by text, WhatsApp refused the number.
  const offersText = state.channel === "whatsapp"
  return (
    <div className="grid gap-3">
      <form action={submitAction}>
        <input type="hidden" name="intent" value="verify" />
        <FieldGroup className="gap-3">
          <Field className="gap-2" data-invalid={Boolean(codeError)}>
            <label htmlFor="add-phone-otp" className="eyebrow">
              Phone code
            </label>
            <CustomerOtpInput
              id="add-phone-otp"
              name="otp"
              autoFocus
              className={`${customerInputClass} font-mono`}
              aria-invalid={Boolean(codeError)}
              aria-describedby={
                codeError ? "add-phone-otp-error" : "add-phone-otp-hint"
              }
            />
            {codeError ? (
              <p
                id="add-phone-otp-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {codeError}
              </p>
            ) : (
              <p
                id="add-phone-otp-hint"
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
            Add phone number
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
            Phone ending{" "}
            <span className="font-bold text-foreground tabular-nums">
              {phone.slice(-4)}
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
              disabled={pending}
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
            Wrong number? Use a different one
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
