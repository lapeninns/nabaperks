import type { Metadata } from "next"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { redirect } from "next/navigation"

import { AUTH_SECTION_MIN_H } from "@/app/(auth)/viewport"

import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getCurrentUser } from "@/lib/auth/session"
import { merchantEmailOtpAliasLength } from "@/lib/auth/merchant-email-otp-alias"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Merchant log in",
  description: "Log in to your Nabaperks merchant console.",
}

const trustPoints = [
  "QR kit, stamps, and rewards in one console",
  "Pick up onboarding where you left off",
  "Billing when you activate your live venue QR",
]

/**
 * Copy keyed off the `?error=` value (the LOCATION_STATUS_COPY pattern) so a
 * future error param never silently inherits OTP-specific guidance. Only
 * `verification` is minted today (app/auth/confirm/route.ts); anything else
 * gets honest generic copy.
 */
const LOGIN_ERROR_COPY: Record<string, { title: string; body: string }> = {
  verification: {
    title: "Email code could not be used",
    body: "Request a fresh code. Provider details are hidden for safety.",
  },
}

const LOGIN_ERROR_FALLBACK = {
  title: "Sign-in problem",
  body: "Something went wrong on the way in. Request a fresh email code and try again.",
}

type LoginPageProps = {
  searchParams: Promise<{
    email?: string | string[]
    next?: string | string[]
    error?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const user = await getCurrentUser()
  const email = firstSearchParam(params.email)
  const next = safeMerchantNextPath(firstSearchParam(params.next) ?? "/app")
  const error = firstSearchParam(params.error)

  if (user) {
    redirect(safeMerchantNextPath(next))
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
            eyebrow="Merchant access"
            title="Welcome back to your loyalty counter."
            description="Log in to continue venue setup, download your QR kit, manage checks, and review loyalty activity."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7 text-pretty"
            className="md:grid-cols-1"
          />
          <ul className="grid gap-2.5 border-t-2 border-dashed border-border pt-5">
            {trustPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-sm leading-snug font-bold"
              >
                <Icon
                  icon={Tick02Icon}
                  size={16}
                  strokeWidth={2.5}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span className="text-pretty">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <ReceiptCard edge className="order-1 w-full lg:order-2">
          <div className="mb-5 grid gap-1">
            <Eyebrow>Merchant console</Eyebrow>
            <h2 className="text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-extrabold text-balance">
              Back to the counter
            </h2>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              Enter your venue email and we will send a one-time sign-in code.
            </p>
          </div>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>
                {(LOGIN_ERROR_COPY[error] ?? LOGIN_ERROR_FALLBACK).title}
              </AlertTitle>
              <AlertDescription>
                {(LOGIN_ERROR_COPY[error] ?? LOGIN_ERROR_FALLBACK).body}
              </AlertDescription>
            </Alert>
          ) : null}
          <ResetPasswordForm
            otpLength={merchantEmailOtpAliasLength()}
            next={next}
            initialEmail={email}
          />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}

function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
