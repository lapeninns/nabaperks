import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AUTH_SECTION_MIN_H } from "@/app/(auth)/viewport"
import { SignupVerifyForm } from "@/components/auth/signup-verify-form"
import { Eyebrow, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import {
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
} from "@/lib/auth/merchant-email-otp-alias"
import { getCurrentUser } from "@/lib/auth/session"
import { ROUTES } from "@/lib/marketing/facts"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
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
  const next = firstParam(params.next) ?? "/app/onboarding"

  if (!email || !looksLikeEmail(email)) {
    redirect(ROUTES.signup)
  }

  const user = await getCurrentUser()
  if (user) {
    redirect(safeMerchantNextPath(next))
  }

  const otpCodeLabel = merchantEmailOtpAliasDigitLabel()

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
            description={`Enter the ${otpCodeLabel} code we sent, then continue to your venue setup.`}
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7 text-pretty"
            className="md:grid-cols-1"
          />
          <div className="border-t-2 border-dashed border-border pt-5">
            <p className="max-w-xl text-sm leading-6 font-bold text-pretty">
              Your operator account is created. Verifying your email confirms
              it — then you set up your business, venue, and rewards. Keep this
              tab open while you check your inbox.
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
              Use the {otpCodeLabel} code from your email. You can resend it
              here if the first one has gone missing.
            </p>
          </div>
          <SignupVerifyForm
            email={email}
            name={name}
            next={next}
            otpLength={merchantEmailOtpAliasLength()}
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
