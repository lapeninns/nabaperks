import { headers } from "next/headers"

import {
  ClaimUnsubscribePanel,
  ClaimUnsubscribeShell,
  type ClaimUnsubscribeState,
} from "@/components/customer/claim-unsubscribe-panel"
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
        <ClaimUnsubscribeShell title="Try again shortly">
          <p className="text-sm leading-6 text-muted-foreground">
            Too many attempts from here. Please try again in a few minutes.
          </p>
        </ClaimUnsubscribeShell>
      )
    }
    throw error
  }

  const state: ClaimUnsubscribeState =
    sp.unsubscribe === "done"
      ? "done"
      : sp.unsubscribe === "failed"
        ? "failed"
        : "default"

  return (
    <ClaimUnsubscribePanel
      state={state}
      token={token}
      action={unsubscribeRewardInviteAction}
    />
  )
}
