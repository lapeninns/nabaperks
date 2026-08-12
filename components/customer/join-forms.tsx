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

export type CustomerIdentityAction = (
  state: CustomerIdentityState,
  formData: FormData
) => Promise<CustomerIdentityState>

export type CustomerJoinAction = (
  state: CustomerJoinState,
  formData: FormData
) => Promise<CustomerJoinState>

export type CustomerIdentityFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  requestIdentityAction?: CustomerIdentityAction
}

export function CustomerIdentityForm({
  merchantSlug,
  qrId,
  referralCode,
  requestIdentityAction = requestCustomerIdentityAction,
}: CustomerIdentityFormProps) {
  const [state, requestAction, requestPending] = useActionState(
    requestIdentityAction,
    identityInitialState
  )
  const contactErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!state.errors?.contact) return
    contactErrorRef.current?.focus({ preventScroll: true })
    contactErrorRef.current?.scrollIntoView({ block: "center" })
  }, [state])

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <input type="hidden" name="ref" value={referralCode ?? ""} />
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
            <p
              id="contact-error"
              ref={contactErrorRef}
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
              className="text-sm text-destructive"
            >
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
          {requestPending ? "Sending…" : "Text me the code"}
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
        className="inline-flex min-h-11 min-w-11 items-center justify-center self-center text-center text-xs font-bold underline underline-offset-4"
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
  requireGeofence: boolean
  joinAction?: CustomerJoinAction
}

export function CustomerJoinForm({
  merchantSlug,
  qrId,
  referralCode,
  merchantName,
  card,
  requireGeofence,
  joinAction = joinRewardsAction,
}: CustomerJoinFormProps) {
  const [state, action, pending] = useActionState(joinAction, joinInitialState)
  const loyaltyTermsRef = useRef<HTMLInputElement>(null)
  const [loyaltyTermsAccepted, setLoyaltyTermsAccepted] = useState(false)
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
      {/* One flat wrapper, two inline checkboxes — the consent rows share a
          single surface instead of two stacked bordered cards, so the primary
          CTA stays above the fold on small screens. */}
      <fieldset className="surface-card grid gap-3 p-4 text-sm">
        <legend className="sr-only">Join choices</legend>
        <label className="flex items-start gap-3">
          <input
            ref={loyaltyTermsRef}
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
            name="marketingOptIn"
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="grid gap-1">
            <Eyebrow>Marketing updates</Eyebrow>
            <span className="leading-6 text-muted-foreground">
              Send me occasional offers from this business. Optional.
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
      <p className="text-center text-xs leading-5 text-muted-foreground">
        {joinCompletionHint({
          hasQr: Boolean(qrId),
          requireGeofence,
        })}
      </p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending
          ? qrId
            ? "Stamping…"
            : "Saving…"
          : qrId
            ? "Get my first stamp"
            : "Save my card"}
      </Button>
    </form>
  )
}
