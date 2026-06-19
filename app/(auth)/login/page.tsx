import { signInAction } from "@/app/(auth)/actions"
import { Eyebrow, PageTitle, ReceiptCard, VenueMark } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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
      <section className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-5xl content-start gap-10 px-6 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:content-center lg:items-center">
        <div className="grid gap-6">
          <PageTitle
            eyebrow="Merchant access"
            title="Welcome back to your loyalty counter."
            description="Log in to continue onboarding, launch QR downloads, manage venue checks, and review loyalty activity."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7"
            className="md:grid-cols-1"
          />
          <ReceiptCard edge className="flex items-center gap-4">
            <VenueMark size={52} />
            <div className="grid gap-1">
              <Eyebrow>Your venue, one tap away</Eyebrow>
              <p className="text-sm leading-5 font-bold">
                Stamps, rewards, and the printed QR kit, all from one console.
              </p>
            </div>
          </ReceiptCard>
        </div>

        <ReceiptCard edge className="w-full">
          <div className="mb-6 grid gap-2">
            <p className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Log in
            </p>
            <h2 className="text-3xl leading-tight font-extrabold">
              Continue merchant setup
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Use the email and password for your Nabaperks merchant account.
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
          <AuthForm action={signInAction} mode="sign-in" next={params.next} />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}
