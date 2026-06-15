"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  requestCustomerIdentityAction,
  verifyCustomerOtpAction,
  type CustomerIdentityState,
} from "@/app/m/[merchantSlug]/join/actions"
import {
  GeoFields,
  LocationNote,
  useOptionalGeolocation,
} from "@/components/customer/self-service-forms"
import { Button } from "@/components/ui/button"
import type { LocationRequirement } from "@/lib/customer/experience/types"

const identityInitialState: CustomerIdentityState = {}

export function CustomerOtpForm({
  merchantSlug,
  qrId,
  contact,
  location,
}: {
  merchantSlug: string
  qrId?: string
  contact: string
  location: LocationRequirement
}) {
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCustomerOtpAction,
    identityInitialState
  )
  const [, requestAction, requestPending] = useActionState(
    requestCustomerIdentityAction,
    identityInitialState
  )
  const { note, handleSubmit } = useOptionalGeolocation(location)
  const state = verifyState

  return (
    <div className="grid gap-4">
      <form
        action={verifyAction}
        onSubmit={handleSubmit}
        className="grid gap-4"
      >
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <GeoFields />
        <div className="grid gap-2">
          <label htmlFor="otp" className="eyebrow">
            Text code
          </label>
          <input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 font-mono text-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
            aria-invalid={Boolean(state.errors?.otp)}
          />
          {state.errors?.otp ? (
            <p className="text-sm text-destructive">{state.errors.otp}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Enter the verification code sent to your phone.
            </p>
          )}
        </div>
        <LocationNote note={note} />
        {state.errors?.form ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        {state.errors?.contact ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.contact}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={verifyPending}
        >
          {verifyPending ? "Checking..." : "Save my card"}
        </Button>
      </form>

      <form action={requestAction} className="grid gap-3">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <input type="hidden" name="contact" value={contact} />
        <div className="surface-card grid gap-2 p-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow text-muted-foreground">Sent to</span>
            <Button
              type="submit"
              variant="link"
              size="xs"
              className="shrink-0 text-xs"
              disabled={requestPending}
            >
              {requestPending ? "Sending..." : "Resend code"}
            </Button>
          </div>
          <p className="text-sm font-bold tabular-nums">{contact}</p>
          <Link
            href={`/m/${merchantSlug}/join?${qrId ? `qr=${qrId}&` : ""}step=phone`}
            className="w-fit text-xs font-bold underline underline-offset-4"
          >
            Use a different number
          </Link>
        </div>
      </form>
    </div>
  )
}
