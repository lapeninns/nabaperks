import { signUpAction } from "@/app/(auth)/actions"
import { Eyebrow, PageTitle, ReceiptCard, VenueMark } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"

const trustPoints = [
  "No app to download",
  "No card to start the pilot",
  "Stamped in seconds at the counter",
]

export default function SignUpPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-5xl content-center gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center">
        <div className="grid gap-6">
          <PageTitle
            eyebrow="Start trial"
            title="Your first stamp is waiting."
            description="Create a merchant account for your first QR loyalty card. Verify your email, then continue through the safe setup path to add your venue, card, rewards, and QR assets."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7"
            className="md:grid-cols-1"
          />
          <ReceiptCard edge className="grid gap-3">
            <div className="flex items-center gap-3">
              <VenueMark size={46} />
              <Eyebrow>30-day pilot · no card</Eyebrow>
            </div>
            <ul className="grid gap-2">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-baseline gap-3 text-sm font-bold">
                  <span aria-hidden="true" className="text-primary">
                    ✱
                  </span>
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
              Use email and password to start the 5-minute setup. Verification
              continues through /auth/confirm before onboarding.
            </p>
          </div>
          <AuthForm action={signUpAction} mode="sign-up" />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}
