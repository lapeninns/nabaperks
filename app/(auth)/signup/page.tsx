import { Tick02Icon } from "@hugeicons/core-free-icons"

import { signUpAction } from "@/app/(auth)/actions"
import {
  Eyebrow,
  Icon,
  PageTitle,
  ReceiptCard,
  VenueMark,
} from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"

const trustPoints = [
  "No app to download",
  "Card required to go live",
  "Stamped in seconds at the counter",
]

export default function SignUpPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-5xl content-start gap-10 px-6 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:content-center lg:items-center">
        <div className="grid gap-6">
          <PageTitle
            eyebrow="Start trial"
            title="Your first stamp is waiting."
            description="Create a merchant account for your first QR loyalty card. Verify your email, then add your venue, card, rewards, QR assets, and billing card before launch."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7"
            className="md:grid-cols-1"
          />
          <ReceiptCard edge className="grid gap-3">
            <div className="flex items-center gap-3">
              <VenueMark size={46} />
              <Eyebrow>30 days free · card required</Eyebrow>
            </div>
            <ul className="grid gap-2">
              {trustPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-3 text-sm font-bold"
                >
                  <Icon
                    icon={Tick02Icon}
                    size={16}
                    strokeWidth={2.5}
                    className="text-primary"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </ReceiptCard>
        </div>

        <ReceiptCard edge className="w-full">
          <div className="mb-6 grid gap-2">
            <p className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Merchant account
            </p>
            <h2 className="text-3xl leading-tight font-extrabold">
              Start your 30-day free pilot
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Use email and password to start the 5-minute setup. Your email
              link lands at /auth/confirm; add a card to activate the venue,
              and billing starts after the free trial.
            </p>
          </div>
          <AuthForm action={signUpAction} mode="sign-up" />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}
