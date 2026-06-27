import { Tick02Icon } from "@hugeicons/core-free-icons"

import { signUpAction } from "@/app/(auth)/actions"
import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"

const trustPoints = [
  "No app for your customers to download",
  "Customers stamp themselves from your venue QR",
  "Billing when you activate your live venue QR",
]

export default function SignUpPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-5xl content-start gap-8 px-6 py-6 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:content-center lg:items-center">
        <div className="order-2 grid gap-6 lg:order-1">
          <PageTitle
            eyebrow="Start free pilot"
            title="Your first stamp is waiting."
            description="Set up your venue QR loyalty card in about five minutes. Verify your email, then add your venue, rewards, and printed kit."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7 text-pretty"
            className="md:grid-cols-1"
          />
          <ul className="grid gap-2.5 border-t-2 border-dashed border-border pt-5">
            {trustPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-sm font-bold leading-snug"
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
              Email and password to get started. We will send a verification
              link; billing starts after your free trial when you go live.
            </p>
          </div>
          <AuthForm action={signUpAction} mode="sign-up" embedded />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}
