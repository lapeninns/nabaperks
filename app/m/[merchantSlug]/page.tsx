import Link from "next/link"
import { notFound } from "next/navigation"

import { Eyebrow } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { getMerchantJoinContext } from "@/lib/customer/join"

type MerchantRewardsPageProps = {
  params: Promise<{
    merchantSlug: string
  }>
}

export default async function MerchantRewardsPage({
  params,
}: MerchantRewardsPageProps) {
  const { merchantSlug } = await params
  const context = await getMerchantJoinContext(merchantSlug)

  if (!context?.available) {
    notFound()
  }

  return (
    <CustomerShell className="grid content-center">
      <section className="grid gap-5 rounded-3xl border bg-card p-6 text-center shadow-xs">
        <Eyebrow>No app loyalty</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">
          {context.merchant.business_name} Rewards
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Collect three visit stamps to reveal a surprise reward.
        </p>
        <Button asChild>
          <Link href={`/m/${merchantSlug}/join`}>Join rewards</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/merchant/${merchantSlug}/terms`}>View reward terms</Link>
        </Button>
      </section>
    </CustomerShell>
  )
}
