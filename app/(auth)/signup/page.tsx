import { signUpAction } from "@/app/(auth)/actions"
import { PageTitle } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"

export default function SignUpPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-5xl content-center gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center">
        <PageTitle
          eyebrow="Start trial"
          title="Create a merchant account for your first QR loyalty card."
          description="Sign up, verify your email, and continue through the safe setup path to add your venue, card, rewards, and QR assets."
          titleClassName="text-4xl sm:text-5xl"
          descriptionClassName="text-base leading-7"
        />
        <div className="w-full rounded-[2rem] border bg-card p-6 shadow-xs">
          <div className="mb-6 grid gap-2">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
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
        </div>
      </section>
    </MarketingLayout>
  )
}
