import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import { StatusBanner } from "@/components/loyalty"
import { customerEmailAuthMode } from "@/lib/customer/email-auth-mode"
import type { CustomerLoginOtpState } from "@/app/home/actions"
import { phoneCodeStepTiming } from "@/lib/customer/phone-code-email-fallback"
import {
  getCustomerSession,
  getPendingPhoneVerification,
} from "@/lib/customer/session"
import { signedOutNotice } from "@/lib/customer/session-signed-out-notice"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Open my cards · Nabaperks",
}

type HomeLoginPageProps = {
  searchParams: Promise<{
    next?: string | string[] | undefined
    signed_out?: string | string[] | undefined
  }>
}

export default async function HomeLoginPage({
  searchParams,
}: HomeLoginPageProps) {
  const params = await searchParams
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next
  const next = safeNextPath(nextParam ?? "/home")
  const session = await getCustomerSession()

  if (session) {
    redirect(next)
  }

  const notice = signedOutNotice(params.signed_out)

  return (
    <CustomerShell>
      {notice ? (
        <StatusBanner tone="warning" title={notice} className="mb-4" />
      ) : null}
      <CustomerLoginForm
        next={next}
        emailMode={customerEmailAuthMode()}
        initialState={await pendingPhoneCodeStep()}
      />
    </CustomerShell>
  )
}

/**
 * A reload keeps a wallet phone code that is still pending: the page opens on
 * its code step, with the email fallback's wait worked out again from when
 * the server sent it, instead of a blank number that costs another text.
 */
async function pendingPhoneCodeStep(): Promise<CustomerLoginOtpState> {
  const pending = await getPendingPhoneVerification()
  if (pending?.purpose !== "wallet") return {}
  return {
    fields: {
      method: "phone",
      contact: pending.phone,
      otpSent: true,
      ...(pending.channel ? { channel: pending.channel } : {}),
      ...phoneCodeStepTiming(pending.issuedAt, Date.now()),
    },
  }
}
