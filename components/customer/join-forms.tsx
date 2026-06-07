"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  joinRewardsAction,
  requestCustomerIdentityAction,
  type CustomerIdentityState,
  type CustomerJoinState,
  verifyCustomerPhoneOtpAction,
} from "@/app/m/[merchantSlug]/join/actions"
import { Button } from "@/components/ui/button"

const identityInitialState: CustomerIdentityState = {}
const joinInitialState: CustomerJoinState = {}

export function CustomerIdentityForm({
  merchantSlug,
  qrId,
}: {
  merchantSlug: string
  qrId?: string
}) {
  const [state, requestAction, requestPending] = useActionState(
    requestCustomerIdentityAction,
    identityInitialState
  )
  const [, verifyAction, verifyPending] = useActionState(
    verifyCustomerPhoneOtpAction,
    identityInitialState
  )
  const emailOtpSent = state.fields?.emailOtpSent
  const phoneOtpSent = state.fields?.phoneOtpSent
  const verificationSent = emailOtpSent || phoneOtpSent

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <div className="grid gap-2">
          <label htmlFor="contact" className="text-sm font-bold">
            Email or phone
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            inputMode="email"
            placeholder="you@example.com or +447..."
            defaultValue={state.fields?.contact}
            className="h-12 rounded-xl border border-input bg-secondary/60 px-4 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
            aria-invalid={Boolean(state.errors?.contact)}
            aria-describedby={state.errors?.contact ? "contact-error" : undefined}
          />
          {state.errors?.contact ? (
            <p id="contact-error" className="text-sm text-destructive">
              {state.errors.contact}
            </p>
          ) : null}
        </div>
        {state.errors?.form ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        {state.message ? (
          <p className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" disabled={requestPending || verificationSent}>
          {requestPending
            ? "Sending..."
            : verificationSent
              ? "Verification sent"
              : "Send verification"}
        </Button>
      </form>

      {phoneOtpSent ? (
        <form action={verifyAction} className="grid gap-4">
          <input
            type="hidden"
            name="contact"
            value={state.fields?.contact ?? ""}
          />
          <input type="hidden" name="merchantSlug" value={merchantSlug} />
          <input type="hidden" name="qrId" value={qrId ?? ""} />
          <div className="grid gap-2">
            <label htmlFor="otp" className="text-sm font-bold">
              Phone code
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              className="h-12 rounded-xl border border-input bg-secondary/60 px-4 font-mono text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
              aria-invalid={Boolean(state.errors?.otp)}
            />
            {state.errors?.otp ? (
              <p className="text-sm text-destructive">{state.errors.otp}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={verifyPending}>
            {verifyPending ? "Checking..." : "Verify phone"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}

export function CustomerJoinForm({
  merchantSlug,
  qrId,
  merchantTermsUrl,
}: {
  merchantSlug: string
  qrId?: string
  merchantTermsUrl: string
}) {
  const [state, action, pending] = useActionState(
    joinRewardsAction,
    joinInitialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="qrId" value={qrId ?? ""} />
      <label className="grid gap-2 rounded-2xl border bg-secondary/50 p-4 text-sm">
        <span className="font-bold">Loyalty terms</span>
        <span className="leading-6 text-muted-foreground">
          I agree to join this loyalty card and understand stamps and rewards
          are subject to the venue terms, platform terms, and privacy notice.
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
          <Link className="underline underline-offset-4" href={merchantTermsUrl}>
            Venue reward terms
          </Link>
          <Link className="underline underline-offset-4" href="/terms">
            Platform terms
          </Link>
          <Link className="underline underline-offset-4" href="/privacy">
            Privacy notice
          </Link>
        </span>
        <input name="loyaltyTerms" type="checkbox" className="size-5 accent-primary" />
      </label>
      {state.errors?.loyaltyTerms ? (
        <p className="text-sm text-destructive">{state.errors.loyaltyTerms}</p>
      ) : null}
      <label className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">
        <span className="font-bold">Marketing updates</span>
        <span className="leading-6 text-muted-foreground">
          Send me occasional offers from this business. This is optional.
        </span>
        <input
          name="marketingOptIn"
          type="checkbox"
          className="size-5 accent-primary"
        />
      </label>
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Joining..." : "Join rewards"}
      </Button>
    </form>
  )
}
