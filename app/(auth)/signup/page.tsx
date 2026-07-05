import type { Metadata } from "next"

import { Tick02Icon } from "@hugeicons/core-free-icons"

import { signUpAction, verifyEmailOtpAction } from "@/app/(auth)/actions"
import { AUTH_SECTION_MIN_H } from "@/app/(auth)/viewport"
import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"
import {
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
} from "@/lib/auth/merchant-email-otp-alias"
import { GUARANTEE, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { OG_IMAGE } from "@/lib/seo/structured-data"
import { cn } from "@/lib/utils"

const title = "Start Your Free Pilot — No-App QR Loyalty"
// 158 code points (budget 145–159); the cancellation term renders only via
// the single-source constant (marketing-auth-legal contract).
const description = `Create your account, build your card and go live from one venue QR — ${PRODUCT.pilot}, then ${PRODUCT.price}. ${PRODUCT.cancelLine}`

/** /signup is an indexable acquisition route (sitemap 0.7) that accepts an
 * ?email= param — the self-canonical collapses those variants (AV-2). */
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.signup },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.signup,
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nabaperks`,
    description,
    images: [OG_IMAGE],
  },
}

const otpCodeLabel = merchantEmailOtpAliasDigitLabel()
const trustPoints = [
  "No app for your customers to download",
  "Customers stamp themselves from your venue QR",
  PRODUCT.cancelLine,
  GUARANTEE.line,
]

type SignUpPageProps = {
  searchParams: Promise<{
    email?: string | string[]
  }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams
  const initialEmail = firstParam(params.email)

  return (
    <MarketingLayout>
      <section
        className={cn(
          "mx-auto grid w-full max-w-5xl content-start gap-8 px-6 py-6 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:content-center lg:items-center",
          AUTH_SECTION_MIN_H
        )}
      >
        <div className="order-2 grid gap-6 lg:order-1">
          <PageTitle
            eyebrow="Start free pilot"
            title="Your first stamp is waiting."
            description={`Set up your venue QR loyalty card in about five minutes. Create your account, verify your email with a ${otpCodeLabel} code, then add your venue, rewards, and printed kit.`}
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
            <Eyebrow>30 days free</Eyebrow>
            <h2 className="text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-extrabold text-balance">
              Open your till
            </h2>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              Create your account and verify your email with a {otpCodeLabel}{" "}
              code. {PRODUCT.cancelLine}
            </p>
          </div>
          <AuthForm
            action={signUpAction}
            verifyAction={verifyEmailOtpAction}
            mode="sign-up"
            otpLength={merchantEmailOtpAliasLength()}
            initialEmail={initialEmail}
            embedded
          />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
