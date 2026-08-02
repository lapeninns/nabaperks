import { headers } from "next/headers"

import { Logo, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  RateLimitError,
  enforceRateLimit,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"

import { unsubscribeRewardInviteAction } from "./actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Email preferences · Nabaperks",
  robots: { index: false, follow: false },
}

/**
 * The unsubscribe capability lives on its own route with its own secret, so a
 * claim URL can no longer be replayed as an opt-out. The page never reveals
 * whether the token resolves to a live invite.
 */
export default async function UnsubscribeRewardInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ unsubscribe?: string }>
}) {
  const { token } = await params
  const sp = searchParams ? await searchParams : {}

  try {
    await enforceRateLimit({
      key: `claim-unsubscribe:${rateLimitIdentityFromHeaders(await headers())}`,
      limit: 30,
      windowMs: 15 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return (
        <UnsubscribeShell title="Try again shortly">
          <p className="text-sm leading-6 text-muted-foreground">
            Too many attempts from here. Please try again in a few minutes.
          </p>
        </UnsubscribeShell>
      )
    }
    throw error
  }

  if (sp.unsubscribe === "done") {
    return (
      <UnsubscribeShell title="You're unsubscribed">
        <p className="text-sm leading-6 text-muted-foreground">
          You won&rsquo;t get invite emails from this venue again.
        </p>
      </UnsubscribeShell>
    )
  }

  if (sp.unsubscribe === "failed") {
    return (
      <UnsubscribeShell title="We couldn't save that change">
        <p className="text-sm leading-6 text-muted-foreground">
          Please try again. Your email preference has not been changed yet.
        </p>
        <form action={unsubscribeRewardInviteAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" variant="secondary" className="w-full">
            Try again
          </Button>
        </form>
      </UnsubscribeShell>
    )
  }

  return (
    <UnsubscribeShell title="Stop these emails?">
      <p className="text-sm leading-6 text-muted-foreground">
        We only email once about a reward, but you can stop invite emails from
        this venue here.
      </p>
      <form action={unsubscribeRewardInviteAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="secondary" className="w-full">
          Stop these emails
        </Button>
      </form>
    </UnsubscribeShell>
  )
}

function UnsubscribeShell({
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
