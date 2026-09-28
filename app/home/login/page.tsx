import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CustomerLoginForm } from "@/components/customer/customer-login-form"
import { CustomerShell } from "@/components/layout"
import { customerEmailAuthMode } from "@/lib/customer/email-auth-mode"
import type { CustomerLoginOtpState } from "@/app/home/actions"
import { phoneCodeStepTiming } from "@/lib/customer/phone-code-email-fallback"
import {
  getCustomerSession,
  getPendingPhoneVerification,
} from "@/lib/customer/session"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "My Nabaperks · sign in",
}

type HomeLoginPageProps = {
  searchParams: Promise<{
    next?: string | string[] | undefined
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

  return (
    <CustomerShell>
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
      ...phoneCodeStepTiming(pending.issuedAt, Date.now()),
    },
  }
}
