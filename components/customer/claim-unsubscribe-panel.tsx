import { Logo, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

export type ClaimUnsubscribeState = "default" | "done" | "failed"

export function ClaimUnsubscribePanel({
  state,
  token,
  action,
}: {
  state: ClaimUnsubscribeState
  token: string
  action: (formData: FormData) => void | Promise<void>
}) {
  if (state === "done") {
    return (
      <ClaimUnsubscribeShell title="You're unsubscribed">
        <p className="text-sm leading-6 text-muted-foreground">
          You won&rsquo;t get invite emails from this venue again.
        </p>
      </ClaimUnsubscribeShell>
    )
  }

  if (state === "failed") {
    return (
      <ClaimUnsubscribeShell title="We couldn't save that change">
        <p className="text-sm leading-6 text-muted-foreground">
          Please try again. Your email preference has not been changed yet.
        </p>
        <UnsubscribeForm token={token} action={action} label="Try again" />
      </ClaimUnsubscribeShell>
    )
  }

  return (
    <ClaimUnsubscribeShell title="Stop these emails?">
      <p className="text-sm leading-6 text-muted-foreground">
        We only email once about a reward, but you can stop invite emails from
        this venue here.
      </p>
      <UnsubscribeForm
        token={token}
        action={action}
        label="Stop these emails"
      />
    </ClaimUnsubscribeShell>
  )
}

export function ClaimUnsubscribeShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <ReceiptCard className="w-full max-w-sm space-y-4 p-6 text-center">
        <Logo />
        <h1 className="text-2xl leading-tight font-extrabold">{title}</h1>
        {children}
      </ReceiptCard>
    </main>
  )
}

function UnsubscribeForm({
  token,
  action,
  label,
}: {
  token: string
  action: (formData: FormData) => void | Promise<void>
  label: string
}) {
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="secondary" className="w-full">
        {label}
      </Button>
    </form>
  )
}
