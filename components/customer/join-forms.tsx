"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef, useState } from "react"

import {
  joinRewardsAction,
  requestCustomerIdentityAction,
  type CustomerIdentityState,
  type CustomerJoinState,
} from "@/app/m/[merchantSlug]/join/actions"
import { Eyebrow, MonoTag } from "@/components/brand"
import { customerInputClass } from "@/components/customer/input-class"
import { JoinActionBar } from "@/components/customer/join-action-bar"
import {
  OTP_SEND_LABEL,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
import { CustomerLegalConsentLinks } from "@/components/customer/legal-sheet"
import { StatusBanner } from "@/components/loyalty"
import type {
  JoinCard,
  JoinContactChannels,
} from "@/lib/customer/experience/types"
import { Button } from "@/components/ui/button"
import { useForgetLegacyContactMethod } from "@/hooks/use-forget-legacy-contact-method"
import {
  joinCompletionHint,
  joinMarketingOptInLabel,
  joinPhoneChannelNote,
  joinRewardRequirementLine,
  JOIN_MARKETING_CHANGE_NOTE,
  JOIN_PHONE_BACK_LABEL,
  JOIN_PHONE_CODE_EXPIRED,
  JOIN_PHONE_SEND_FAILED_EMAIL_LABEL,
} from "@/lib/customer/experience/copy"
import {
  buildCustomerJoinHref,
  buildCustomerMerchantHref,
} from "@/lib/navigation/customer-join-intent"

const identityInitialState: CustomerIdentityState = {}
const joinInitialState: CustomerJoinState = {}

export type CustomerIdentityFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  /** Channel the code goes out on first; the note under the field names it. */
  channel?: OtpChannel
  /**
   * The email step, while email sign-in is on. Offered only when the code
   * could not be sent at all, since that customer never reaches the code step
   * and its fallback.
   */
  emailStepHref?: string
  /** Why the guest is here: their pending code had expired. */
  notice?: "code_expired"
  /** "Wrong number? Change it": the pending number, ready to edit. */
  prefillPhone?: string
}

export function CustomerIdentityForm({
  merchantSlug,
  qrId,
  referralCode,
  channel = "whatsapp",
  emailStepHref,
  notice,
  prefillPhone,
}: CustomerIdentityFormProps) {
  const [state, requestAction, requestPending] = useActionState(
    requestCustomerIdentityAction,
    identityInitialState
  )
  useForgetLegacyContactMethod()
  // The expiry notice stands until this form has an answer of its own.
  const showExpiredNotice =
    notice === "code_expired" && !state.errors && !requestPending

  return (
    <div className="grid gap-4">
      {showExpiredNotice ? (
        <StatusBanner tone="neutral" title={JOIN_PHONE_CODE_EXPIRED} />
      ) : null}
      <form action={requestAction} className="grid gap-4">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <input type="hidden" name="ref" value={referralCode ?? ""} />
        <input type="hidden" name="channel" value={channel} />
        <div className="grid gap-2">
          <label htmlFor="contact" className="eyebrow">
            UK mobile number
          </label>
          <input
            id="contact"
            name="contact"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            placeholder="07700 900123"
            defaultValue={state.fields?.contact ?? prefillPhone}
            className={customerInputClass}
            aria-invalid={Boolean(state.errors?.contact)}
            aria-describedby={
              state.errors?.contact ? "contact-error" : "contact-hint"
            }
            onFocus={(event) =>
              event.currentTarget.scrollIntoView({ block: "center" })
            }
          />
          {state.errors?.contact ? (
            <p
              id="contact-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {state.errors.contact}
            </p>
          ) : (
            <p
              id="contact-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              {joinPhoneChannelNote(channel)}
            </p>
          )}
        </div>
        {state.errors?.form ? (
          // Wet Ink error treatment (CUS-P2-07): the shared banner instead of
          // a hand-rolled 1px box.
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

      {/* A failed send is a genuine delivery failure, so email is offered
          at once, quietly, beside the retry. */}
      {state.fields?.phoneSendFailed && emailStepHref ? (
        <Link
          href={emailStepHref}
          className="focus-ring inline-flex min-h-11 w-fit items-center justify-self-center text-xs font-bold underline underline-offset-4"
        >
          {JOIN_PHONE_SEND_FAILED_EMAIL_LABEL}
        </Link>
      ) : null}

      {/* Back to re-read the offer (VCU-P3-10): the QR journey returns to the
          welcome step; a direct join links the venue page, which carries the
          same preview. */}
      <Link
        href={
          qrId
            ? buildCustomerJoinHref(merchantSlug, {
                qrId,
                referralCode,
                step: "welcome",
              })
            : buildCustomerMerchantHref(merchantSlug, referralCode)
        }
        className="focus-ring inline-flex min-h-11 w-fit items-center justify-self-center text-xs font-bold underline underline-offset-4"
      >
        {JOIN_PHONE_BACK_LABEL}
      </Link>
    </div>
  )
}

export type CustomerJoinFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  merchantName: string
  card: JoinCard
  /** What the wallet can be contacted on; the marketing line follows it. */
  contactChannels?: JoinContactChannels
  /** A reward on this card may be age checked (from the card data). */
  rewardMayNeedPhotoId?: boolean
}

/**
 * The join step: one required control for the card terms and, visually
 * separate under "Optional", one unticked marketing choice. No control
 * ticks both: each box is its own decision, and the guest can join and get
 * their stamp without marketing. The server records
 * `loyaltyTerms` and `marketingOptIn` exactly as they are posted.
 */
export function CustomerJoinForm({
  merchantSlug,
  qrId,
  referralCode,
  merchantName,
  card,
  contactChannels = { phone: true, email: false },
  rewardMayNeedPhotoId = false,
}: CustomerJoinFormProps) {
  const [state, action, pending] = useActionState(
    joinRewardsAction,
    joinInitialState
  )
  const loyaltyTermsRef = useRef<HTMLInputElement>(null)
  const [loyaltyTermsAccepted, setLoyaltyTermsAccepted] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  // No confirmed channel: a tick would record nothing, so no field is posted
  // and the server reads the missing choice as no.
  const marketingLabel = joinMarketingOptInLabel(merchantName, contactChannels)
  const loyaltyTermsError = loyaltyTermsAccepted
    ? undefined
    : state.errors?.loyaltyTerms

  useEffect(() => {
    if (!loyaltyTermsError) return
    loyaltyTermsRef.current?.focus({ preventScroll: true })
    loyaltyTermsRef.current?.scrollIntoView({ block: "center" })
  }, [loyaltyTermsError])

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="qrId" value={qrId ?? ""} />
      <input type="hidden" name="ref" value={referralCode ?? ""} />
      <fieldset className="surface-card grid gap-2.5 p-3 text-sm sm:p-4">
        <legend className="sr-only">Card terms</legend>
        <label className="flex items-start gap-3">
          <input
            ref={loyaltyTermsRef}
            id="loyalty-terms"
            name="loyaltyTerms"
            type="checkbox"
            checked={loyaltyTermsAccepted}
            onChange={(event) =>
              setLoyaltyTermsAccepted(event.currentTarget.checked)
            }
            className="mt-0.5 size-6 shrink-0 accent-primary"
            aria-invalid={Boolean(loyaltyTermsError)}
            aria-describedby={
              loyaltyTermsError
                ? "loyalty-terms-error loyalty-terms-requirements"
                : "loyalty-terms-requirements"
            }
          />
          <span className="grid gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Eyebrow>Card terms</Eyebrow>
              <MonoTag tone="accent">Required</MonoTag>
            </span>
            <span className="leading-6 text-muted-foreground">
              <CustomerLegalConsentLinks
                venueTerms={{
                  merchantName,
                  stampsRequired: card.stampsRequired,
                  rewardTerms: card.rewardTerms,
                  collectionWindows: card.collectionWindows,
                  tradingDayStartsAt: card.tradingDayStartsAt,
                  rewardExpiresAfterDays: card.rewardExpiresAfterDays,
                  minimumSpendPence: card.minimumSpendPence,
                  oneTransactionPerStamp: card.oneTransactionPerStamp,
                  rewardPool: card.rewardPool,
                }}
              />
            </span>
          </span>
        </label>
        <p
          id="loyalty-terms-requirements"
          className="text-xs leading-5 text-muted-foreground"
        >
          {joinRewardRequirementLine({ mayNeedPhotoId: rewardMayNeedPhotoId })}
        </p>
      </fieldset>
      {loyaltyTermsError ? (
        // Linked from the checkbox via aria-describedby, matching the phone
        // field's pattern (CUS-P3-02).
        <p id="loyalty-terms-error" className="text-sm text-destructive">
          {loyaltyTermsError}
        </p>
      ) : null}
      {marketingLabel ? (
        <fieldset className="grid gap-2 rounded-lg border-2 border-dashed border-border p-3 text-sm">
          <legend className="px-1">
            <Eyebrow>Optional</Eyebrow>
          </legend>
          <label className="flex items-start gap-3">
            <input
              id="marketing-opt-in"
              name="marketingOptIn"
              type="checkbox"
              checked={marketingOptIn}
              onChange={(event) =>
                setMarketingOptIn(event.currentTarget.checked)
              }
              className="mt-0.5 size-6 shrink-0 accent-primary"
              aria-describedby="marketing-opt-in-note"
            />
            <span className="grid gap-0.5">
              <span className="leading-6 font-semibold">{marketingLabel}</span>
              <span
                id="marketing-opt-in-note"
                className="text-xs leading-5 text-muted-foreground"
              >
                {JOIN_MARKETING_CHANGE_NOTE}
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}
      {state.errors?.form ? (
        // Wet Ink error treatment (CUS-P2-07): the shared banner instead of
        // a hand-rolled 1px box.
        <StatusBanner tone="error" title={state.errors.form} />
      ) : null}
      {/* No text field on this step, so the action can pin to the bottom of
          the viewport on short phones (JoinActionBar) with the completion
          hint riding under it. */}
      <JoinActionBar
        note={joinCompletionHint({
          hasQr: Boolean(qrId),
          savedTo: contactChannels.phone ? "number" : "email",
        })}
      >
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending
            ? qrId
              ? "Adding your stamp…"
              : "Saving…"
            : qrId
              ? "Add my first stamp"
              : "Save my card"}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {pending ? (qrId ? "Adding your stamp" : "Saving your card") : ""}
        </p>
      </JoinActionBar>
    </form>
  )
}
