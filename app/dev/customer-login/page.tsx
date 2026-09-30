import { notFound } from "next/navigation"

import type { CustomerLoginOtpState } from "@/app/home/actions"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import type { JoinEmailMode } from "@/lib/customer/experience/types"
import { phoneCodeStepTiming } from "@/lib/customer/phone-code-email-fallback"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { submitLoginFixture } from "./actions"

/**
 * `?sentAt=` (epoch seconds) opens on the code step of a phone code the
 * server sent then, as /home/login does on a reload with a code pending.
 * `?scenario=` picks a fixture answer: `send-error`, `resend-error`,
 * `expired` (back to the number, kept), `verify-error`, `sign-in-error`,
 * `unknown` (no cards for the number), `email-send-error`, `email-unknown`,
 * `email-expired`.
 */
function harnessInitialState(
  sentAt: string | undefined
): CustomerLoginOtpState {
  const seconds = Number(sentAt)
  if (!sentAt || !Number.isSafeInteger(seconds)) return {}
  return {
    fields: {
      method: "phone",
      contact: "+447700900123",
      otpSent: true,
      channel: "whatsapp",
      ...phoneCodeStepTiming(seconds, Date.now()),
    },
  }
}

/** `?mode=existing|full` shows email sign-in; anything else is phone only. */
function harnessEmailMode(mode: string | undefined): JoinEmailMode {
  return mode === "existing" || mode === "full" ? mode : "off"
}

export default async function CustomerLoginHarness({
  searchParams,
}: {
  searchParams: Promise<{
    scenario?: string
    next?: string
    mode?: string
    sentAt?: string
  }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  const {
    scenario = "default",
    next = "/home",
    mode,
    sentAt,
  } = await searchParams
  return (
    <CustomerShell>
      <CustomerLoginForm
        next={safeNextPath(next)}
        emailMode={harnessEmailMode(mode)}
        initialState={harnessInitialState(sentAt)}
        loginAction={submitLoginFixture.bind(null, scenario)}
      />
    </CustomerShell>
  )
}
