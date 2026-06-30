import { Tick02Icon } from "@hugeicons/core-free-icons"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import {
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
} from "@/lib/auth/merchant-email-otp-alias"

const otpCodeLabel = merchantEmailOtpAliasDigitLabel()
const trustPoints = [
  "Reset takes about a minute",
  `We email a ${otpCodeLabel} code to confirm it is you`,
  "Your venue setup and loyalty data stay exactly as they were",
]

export default function ResetPasswordPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-5xl content-start gap-8 px-6 py-6 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:content-center lg:items-center">
        <div className="order-2 grid gap-6 lg:order-1">
          <PageTitle
            eyebrow="Merchant access"
            title="Reset your console password."
            description={`Enter your venue email and we will send a ${otpCodeLabel} code. Use it to set a new password and get back to your counter.`}
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
              Reset password
            </h2>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              Enter your venue email. We will send a {otpCodeLabel} reset code.
            </p>
          </div>
          <ResetPasswordForm otpLength={merchantEmailOtpAliasLength()} />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}
