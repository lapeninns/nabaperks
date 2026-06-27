import { Tick02Icon } from "@hugeicons/core-free-icons"

import { signInAction } from "@/app/(auth)/actions"

import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const trustPoints = [
  "QR kit, stamps, and rewards in one console",
  "Pick up onboarding where you left off",
  "Billing when you activate your live venue QR",
]

type LoginPageProps = {
  searchParams: Promise<{
    next?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-5xl content-start gap-8 px-6 py-6 sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:content-center lg:items-center">
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
            <Eyebrow>Merchant console</Eyebrow>
            <h2 className="text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-extrabold text-balance">
              Back to the counter
            </h2>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              Use the email and password for your venue account.
            </p>
          </div>
          {params.error ? (
            <Alert
              variant="destructive"
              className="mb-4 border-destructive/30 bg-destructive/10"
            >
              <AlertTitle>Verification link could not be used</AlertTitle>
              <AlertDescription>
                Log in or request a fresh link. Provider details are hidden for
                safety.
              </AlertDescription>
            </Alert>
          ) : null}
          <AuthForm
            action={signInAction}
            mode="sign-in"
            next={params.next}
            embedded
          />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}
