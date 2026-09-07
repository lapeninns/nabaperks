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
  otpChannelSendLabel,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
import { CustomerLegalConsentLinks } from "@/components/customer/legal-sheet"
import { StatusBanner } from "@/components/loyalty"
import type { JoinCard } from "@/lib/customer/experience/types"
import { Button } from "@/components/ui/button"
import {
  joinCompletionHint,
  JOIN_PHONE_BACK_LABEL,
  JOIN_PHONE_RETENTION_HINT,
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
  /** Channel the code goes out on first; the button says where. */
  channel?: OtpChannel
}

export function CustomerIdentityForm({
  merchantSlug,
  qrId,
  referralCode,
  channel = "whatsapp",
}: CustomerIdentityFormProps) {
  const [state, requestAction, requestPending] = useActionState(
    requestCustomerIdentityAction,
    identityInitialState
  )

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <input type="hidden" name="ref" value={referralCode ?? ""} />
        <input type="hidden" name="channel" value={channel} />
        <div className="grid gap-2">
          <label htmlFor="contact" className="eyebrow">
            UK phone number
          </label>
          <input
            id="contact"
            name="contact"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            placeholder="07400 123456"
            defaultValue={state.fields?.contact}
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
            <p id="contact-error" className="text-sm text-destructive">
              {state.errors.contact}
            </p>
          ) : (
            <p
              id="contact-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              {JOIN_PHONE_RETENTION_HINT}
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
          {requestPending ? "Sending…" : otpChannelSendLabel(channel)}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {requestPending ? "Sending your code" : ""}
        </p>
      </form>

      {/* A back affordance to re-read the offer always renders (VCU-P3-10):
          the QR journey returns to the welcome step; a direct join links the
          venue landing, which carries the same preview. */}
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
        className="text-center text-xs font-bold underline underline-offset-4"
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
}

export function CustomerJoinForm({
  merchantSlug,
  qrId,
  referralCode,
  merchantName,
  card,
}: CustomerJoinFormProps) {
  const [state, action, pending] = useActionState(
    joinRewardsAction,
    joinInitialState
  )
  const loyaltyTermsRef = useRef<HTMLInputElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [loyaltyTermsAccepted, setLoyaltyTermsAccepted] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const allSelected = loyaltyTermsAccepted && marketingOptIn
  const loyaltyTermsError = loyaltyTermsAccepted
    ? undefined
    : state.errors?.loyaltyTerms

  useEffect(() => {
    if (!loyaltyTermsError) return
    loyaltyTermsRef.current?.focus({ preventScroll: true })
    loyaltyTermsRef.current?.scrollIntoView({ block: "center" })
  }, [loyaltyTermsError])

  // The "select all" box reflects the two real choices beneath it: checked
  // when both are, mixed when one is, clear when neither. It is a shortcut
  // for a genuine choice, never a pre-tick — both rows start clear.
  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate =
      !allSelected && (loyaltyTermsAccepted || marketingOptIn)
  }, [allSelected, loyaltyTermsAccepted, marketingOptIn])

  function selectAll(checked: boolean) {
    setLoyaltyTermsAccepted(checked)
    setMarketingOptIn(checked)
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="qrId" value={qrId ?? ""} />
      <input type="hidden" name="ref" value={referralCode ?? ""} />
      {/* One surface, three rows. The highlighted "select all" row is the
          one-tap path; the two rows beneath it are the real, separate choices
          (the marketing box is optional and never pre-ticked), so a guest who
          wants only the card can still take exactly that. */}
      <fieldset className="surface-card grid gap-2.5 p-3 text-sm sm:p-4">
        <legend className="sr-only">Join choices</legend>
        <label className="-m-1 flex items-center gap-3 rounded-lg border-2 border-ink bg-primary/10 p-3">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={(event) => selectAll(event.currentTarget.checked)}
            aria-controls="loyalty-terms marketing-opt-in"
            className="size-6 shrink-0 accent-primary"
          />
          <span className="grid gap-0.5">
            <span className="text-base leading-tight font-extrabold">
              Yes to all
            </span>
            <span className="text-xs leading-5 text-muted-foreground">
              Accept the terms and hear about offers from {merchantName}. Or
              pick below.
            </span>
          </span>
        </label>
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
            className="mt-0.5 size-5 shrink-0 accent-primary"
            aria-invalid={Boolean(loyaltyTermsError)}
            aria-describedby={
              loyaltyTermsError ? "loyalty-terms-error" : undefined
            }
          />
          <span className="grid gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Eyebrow>Loyalty terms</Eyebrow>
              <MonoTag tone="accent">Required</MonoTag>
            </span>
            <span className="leading-6 text-muted-foreground">
              <CustomerLegalConsentLinks
                venueTerms={{
                  merchantName,
                  stampsRequired: card.stampsRequired,
                  rewardTerms: card.rewardTerms,
                }}
              />
            </span>
          </span>
        </label>
        <hr className="w-rule" />
        <label className="flex items-start gap-3">
          <input
            id="marketing-opt-in"
            name="marketingOptIn"
            type="checkbox"
            checked={marketingOptIn}
            onChange={(event) => setMarketingOptIn(event.currentTarget.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="grid gap-0.5">
            <Eyebrow>Offers and perks</Eyebrow>
            <span className="text-xs leading-5 text-muted-foreground">
              Occasional offers from {merchantName}. Optional, unsubscribe any
              time.
            </span>
          </span>
        </label>
      </fieldset>
      {loyaltyTermsError ? (
        // Linked from the checkbox via aria-describedby, matching the phone
        // field's pattern (CUS-P3-02).
        <p id="loyalty-terms-error" className="text-sm text-destructive">
          {loyaltyTermsError}
        </p>
      ) : null}
      {state.errors?.form ? (
        // Wet Ink error treatment (CUS-P2-07): the shared banner instead of
        // a hand-rolled 1px box.
        <StatusBanner tone="error" title={state.errors.form} />
      ) : null}
      {/* No text field on this step, so the action can pin to the bottom of
          the viewport on short phones (JoinActionBar) with the completion
          hint riding under it. */}
      <JoinActionBar note={joinCompletionHint({ hasQr: Boolean(qrId) })}>
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending
            ? qrId
              ? "Stamping…"
              : "Saving…"
            : qrId
              ? "Get my first stamp"
              : "Save my card"}
        </Button>
      </JoinActionBar>
    </form>
  )
}
