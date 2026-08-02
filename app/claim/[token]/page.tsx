import { createHash } from "node:crypto"

import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { Logo, MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { attachRewardInvitesForCustomer } from "@/lib/customer/reward-invites"
import {
  RateLimitError,
  enforceRateLimit,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Claim your reward · Nabaperks",
  robots: { index: false, follow: false },
}

type ClaimContext = {
  claim_status: string
  merchant_name: string | null
  reward_name: string | null
  masked_hint: string | null
}

export default async function ClaimRewardPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const claimTokenHash = createHash("sha256").update(token).digest("hex")

  // Public route: cap by IP so a leaked link can't be brute-forced.
  try {
    await enforceRateLimit({
      key: `claim:${rateLimitIdentityFromHeaders(await headers())}`,
      limit: 30,
      windowMs: 15 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return (
        <ClaimShell title="Try again shortly">
          <p className="text-sm leading-6 text-muted-foreground">
            Too many attempts from here. Please try again in a few minutes.
          </p>
        </ClaimShell>
      )
    }
    throw error
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data } = await supabase.rpc("get_reward_invite_claim_context", {
    p_claim_token_hash: claimTokenHash,
  })
  const context = (data?.[0] ?? null) as ClaimContext | null

  if (!context || context.claim_status !== "available") {
    return (
      <ClaimShell title="This reward link isn't available">
        <p className="text-sm leading-6 text-muted-foreground">
          It may have already been claimed or expired. If a venue told you to
          expect a reward, ask them to send it again.
        </p>
      </ClaimShell>
    )
  }

  // A signed-in member claims immediately; the attach is idempotent.
  const customer = await getCurrentCustomer()
  if (customer) {
    await attachRewardInvitesForCustomer(customer.id, { claimTokenHash })
    redirect("/home/rewards")
  }

  const venue = context.merchant_name ?? "A local venue"

  return (
    <ClaimShell title="A reward is waiting for you">
      <MonoTag tone="leaf">{venue}</MonoTag>
      <p className="text-sm leading-6 text-muted-foreground">
        {venue} sent you{" "}
        <span className="font-bold text-foreground">
          {context.reward_name ?? "a reward"}
        </span>
        .{context.masked_hint ? ` Sent to ${context.masked_hint}.` : ""}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        Sign in or join Nabaperks with the same contact and it lands in your
        rewards automatically.
      </p>
      <Button asChild size="lg" className="w-full">
        <Link href="/home">Sign in or join to claim</Link>
      </Button>
    </ClaimShell>
  )
}

function ClaimShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-svh bg-background px-4 py-10">
      <div className="mx-auto grid w-full max-w-customer gap-6">
        <Logo href="/home" />
        <ReceiptCard className="grid gap-3">
          <h1 className="text-xl leading-tight font-extrabold">{title}</h1>
          {children}
        </ReceiptCard>
      </div>
    </main>
  )
}
