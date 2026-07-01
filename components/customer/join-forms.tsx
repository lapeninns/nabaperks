"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  joinRewardsAction,
  requestCustomerIdentityAction,
  type CustomerIdentityState,
  type CustomerJoinState,
} from "@/app/m/[merchantSlug]/join/actions"
import { Eyebrow, MonoTag } from "@/components/brand"
import { customerInputClass } from "@/components/customer/input-class"
import { CustomerLegalConsentLinks } from "@/components/customer/legal-sheet"
import type { JoinCard } from "@/lib/customer/experience/types"
import { Button } from "@/components/ui/button"
import {
  JOIN_PHONE_BACK_LABEL,
  JOIN_PHONE_CODE_HINT,
  joinWelcomeHref,
} from "@/lib/customer/experience/copy"

const identityInitialState: CustomerIdentityState = {}
const joinInitialState: CustomerJoinState = {}

export type CustomerIdentityFormProps = {
  merchantSlug: string
  qrId?: string
}

export function CustomerIdentityForm({
  merchantSlug,
  qrId,
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
        <div className="grid gap-2">
          <label htmlFor="contact" className="eyebrow">
            Phone number
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
              {JOIN_PHONE_CODE_HINT}
            </p>
          )}
        </div>
        {state.errors?.form ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={requestPending}
        >
          {requestPending ? "Sending..." : "Text me the code"}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {requestPending ? "Sending your code" : ""}
        </p>
      </form>

      {qrId ? (
        <Link
          href={joinWelcomeHref(merchantSlug, qrId)}
          className="text-center text-xs font-bold underline underline-offset-4"
        >
          {JOIN_PHONE_BACK_LABEL}
        </Link>
      ) : null}
    </div>
  )
}

export type CustomerJoinFormProps = {
  merchantSlug: string
  qrId?: string
  merchantName: string
  card: JoinCard
  requireGeofence: boolean
  geofenceRadiusMeters: number
}

export function CustomerJoinForm({
  merchantSlug,
  qrId,
  merchantName,
  card,
}: CustomerJoinFormProps) {
  const [state, action, pending] = useActionState(
    joinRewardsAction,
    joinInitialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="qrId" value={qrId ?? ""} />
      {/* One flat wrapper, two inline checkboxes — the consent rows share a
          single surface instead of two stacked bordered cards, so the primary
          CTA stays above the fold on small screens. */}
      <fieldset className="surface-card grid gap-3 p-4 text-sm">
        <label className="flex items-start gap-3">
          <input
            name="loyaltyTerms"
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            aria-invalid={Boolean(state.errors?.loyaltyTerms)}
          />
          <span className="grid gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Eyebrow>Loyalty terms</Eyebrow>
              <MonoTag tone="accent">Required</MonoTag>
            </span>
            <span className="leading-6 text-muted-foreground">
              I agree to keep this loyalty card and that stamps and rewards
              follow the{" "}
              <CustomerLegalConsentLinks
                venueTerms={{
                  merchantName,
                  stampsRequired: card.stampsRequired,
                  rewardTerms: card.rewardTerms,
                }}
              />{" "}
              terms.
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
      {state.errors?.loyaltyTerms ? (
        <p className="text-sm text-destructive">{state.errors.loyaltyTerms}</p>
      ) : null}
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Finish here and your first stamp lands straight away — no second scan
        needed.
      </p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Stamping..." : "Get my first stamp"}
      </Button>
    </form>
  )
}
