import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AUTH_SECTION_MIN_H } from "@/app/(auth)/viewport"
import { SignupVerifyForm } from "@/components/auth/signup-verify-form"
import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import {
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
} from "@/lib/auth/merchant-email-otp-alias"
import { readMerchantOtpResendCooldown } from "@/lib/auth/merchant-otp-resend"
import { getCurrentUser } from "@/lib/auth/session"
import { ROUTES } from "@/lib/marketing/facts"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import { rateLimitIdentityFromHeaders } from "@/lib/security/rate-limit"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Enter the email code for your Nabaperks merchant account.",
  alternates: { canonical: ROUTES.signupVerify },
  robots: { index: false },
}

type SignupVerifyPageProps = {
  searchParams: Promise<{
    email?: string | string[]
    name?: string | string[]
    next?: string | string[]
  }>
}

export default async function SignupVerifyPage({
  searchParams,
}: SignupVerifyPageProps) {
  const params = await searchParams
  const email = firstParam(params.email)?.toLowerCase()
  const name = firstParam(params.name)
  const next = safeMerchantNextPath(
    firstParam(params.next) ?? "/app/onboarding",
    "/app/onboarding"
  )

  if (!email || !looksLikeEmail(email)) {
    redirect(ROUTES.signup)
  }

  const user = await getCurrentUser()
  if (user) {
    redirect(next)
  }

  const otpCodeLabel = merchantEmailOtpAliasDigitLabel()
  let initialRetryAt: string | undefined

  try {
    initialRetryAt = await readMerchantOtpResendCooldown({
      email,
      purpose: "signup",
      requestIdentity: rateLimitIdentityFromHeaders(await headers()),
    })
  } catch {
    // The action still enforces the durable server limit. A failed GET peek
    // must not make the verification route itself unavailable.
    console.error("Merchant signup OTP cooldown readback failed")
  }

  return (
    <MarketingLayout focused>
      <section
        className={cn(
          "mx-auto grid w-full max-w-5xl content-start gap-8 px-6 py-6 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:content-center lg:items-center",
          AUTH_SECTION_MIN_H
        )}
      >
        <div className="order-2 grid gap-6 lg:order-1">
          <PageTitle
            eyebrow="Email check"
            title="Check your email."
            description={`If this email can start a venue account, a ${otpCodeLabel} code may be on its way. If it arrives, enter it to continue to setup.`}
            descriptionClassName="text-base leading-7 text-pretty"
            className="md:grid-cols-1"
          />
          <div className="border-t-2 border-dashed border-border pt-5">
            <p className="max-w-xl text-sm leading-6 font-bold text-pretty">
              A code confirms this email before venue setup. If you have used
              this address before, log in or reset your password instead. Keep
              this tab open while you check your inbox.
            </p>
          </div>
        </div>

        <ReceiptCard edge className="order-1 w-full lg:order-2">
          <div className="mb-5 grid gap-1">
            <Eyebrow>Verify email</Eyebrow>
            <h2 className="text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-extrabold text-balance">
              Enter your code
            </h2>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              Use the {otpCodeLabel} code from your email. No code after a
              minute? Check spam, resend, or use the account recovery links
              below.
            </p>
          </div>
          <SignupVerifyForm
            email={email}
            name={name}
            next={next}
            otpLength={merchantEmailOtpAliasLength()}
            initialRetryAt={initialRetryAt}
          />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
