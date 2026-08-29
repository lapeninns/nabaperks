import type { Metadata } from "next"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { headers } from "next/headers"

import { AUTH_SECTION_MIN_H } from "@/app/(auth)/viewport"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import {
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
} from "@/lib/auth/merchant-email-otp-alias"
import { readMerchantOtpResendCooldown } from "@/lib/auth/merchant-otp-resend"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import { rateLimitIdentityFromHeaders } from "@/lib/security/rate-limit-core"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Reset merchant password",
  description: "Reset the password for your Nabaperks merchant console.",
}

const otpCodeLabel = merchantEmailOtpAliasDigitLabel()
const trustPoints = [
  "Reset takes about a minute",
  `We email a ${otpCodeLabel} code to confirm it is you`,
  "Your venue setup and loyalty data stay exactly as they were",
]

type ResetPasswordPageProps = {
  searchParams: Promise<{
    email?: string | string[]
    next?: string | string[]
    stage?: string | string[]
  }>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams
  const initialEmail = (firstParam(params.email) ?? "").trim().toLowerCase()
  const next = safeMerchantNextPath(firstParam(params.next) ?? "/app")
  const initialOtpSent =
    firstParam(params.stage) === "verify" && looksLikeEmail(initialEmail)
  const initialRetryAt = initialOtpSent
    ? await recoveryCooldown(initialEmail)
    : undefined

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
            title="Reset your console password."
            description={`Enter your venue email and we will send a ${otpCodeLabel} code. Use it to set a new password and get back to your counter.`}
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
              Reset password
            </h2>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              Enter your venue email. We will send a {otpCodeLabel} reset code.
            </p>
          </div>
          <ResetPasswordForm
            key={`${initialOtpSent ? "verify" : "request"}:${initialEmail}:${next}`}
            otpLength={merchantEmailOtpAliasLength()}
            initialEmail={initialEmail}
            initialOtpSent={initialOtpSent}
            initialRetryAt={initialRetryAt}
            next={next}
          />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}

async function recoveryCooldown(email: string) {
  try {
    return await readMerchantOtpResendCooldown({
      email,
      purpose: "recovery",
      requestIdentity: rateLimitIdentityFromHeaders(await headers()),
    })
  } catch (error) {
    // The reset form must stay available when durable rate-limit readback is
    // temporarily unavailable. The POST action still enforces both limits.
    console.error("Merchant recovery cooldown readback failed", {
      error: error instanceof Error ? error.message : "Unknown server error",
    })
    return undefined
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function looksLikeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
