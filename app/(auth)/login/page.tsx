import { signInAction } from "@/app/(auth)/actions"
import { PageTitle } from "@/components/brand"
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
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-5xl content-center gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center">
        <PageTitle
          eyebrow="Merchant access"
          title="Welcome back to your loyalty counter."
          description="Log in to continue onboarding, launch QR downloads, update staff PINs, and check loyalty readbacks."
          titleClassName="text-4xl sm:text-5xl"
          descriptionClassName="text-base leading-7"
        />
        <div className="w-full rounded-[2rem] border bg-card p-6 shadow-xs">
          <div className="mb-6 grid gap-2">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Log in
            </p>
            <h2 className="text-3xl leading-tight font-extrabold">
              Continue merchant setup
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Use the email and password for your Stampiee merchant account.
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
        </div>
      </section>
    </MarketingLayout>
  )
}
