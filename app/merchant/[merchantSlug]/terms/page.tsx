import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow, Logo, ReceiptCard } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getMerchantJoinContext } from "@/lib/customer/join"
import { buildVenueTermsSections } from "@/lib/legal/content"

export const metadata: Metadata = {
  title: "Venue loyalty terms | Nabaperks",
  description:
    "Venue-specific loyalty terms for Nabaperks rewards — earning rules, redemption, exclusions, and venue contact details.",
  robots: {
    index: false,
    follow: false,
  },
}

type MerchantTermsPageProps = {
  params: Promise<{
    merchantSlug: string
  }>
}

export default async function MerchantTermsPage({
  params,
}: MerchantTermsPageProps) {
  const { merchantSlug } = await params
  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>

  try {
    context = await getMerchantJoinContext(merchantSlug)
  } catch {
    return <UnavailableTerms />
  }

  if (!context) return <UnavailableTerms />

  const { merchant, loyaltyCard } = context
  const contact = [merchant.email, merchant.phone].filter(Boolean).join(" · ")
  const termsSections = buildVenueTermsSections({
    merchantName: merchant.business_name,
    stampsRequired: loyaltyCard.stamps_required,
    rewardTerms: loyaltyCard.reward_terms ?? "",
    contact,
  })

  return (
    <CustomerShell className="grid content-center gap-6">
      <section className="grid gap-3 text-center">
        <Eyebrow>Reward terms</Eyebrow>
        <h1 className="text-3xl leading-tight font-extrabold text-balance">
          {merchant.business_name} loyalty terms
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          These loyalty terms are shown before you join and stay available any
          time from your loyalty card.
        </p>
      </section>

      <ReceiptCard edge className="grid gap-4">
        {termsSections.map((section) => (
          <Term key={section.id} label={section.title} value={section.body} />
        ))}
      </ReceiptCard>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={`/m/${merchantSlug}`}>Close</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href="/privacy">Privacy notice</Link>
        </Button>
      </div>
    </CustomerShell>
  )
}

function UnavailableTerms() {
  return (
    <CustomerShell className="grid content-center gap-6">
      <Logo compact className="justify-self-center" />

      <StatusBanner title="Terms unavailable" tone="neutral">
        Ask the venue team for the current loyalty QR before joining.
      </StatusBanner>

      <UnavailableRecoveryActions />
    </CustomerShell>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b pb-4 last:border-b-0 last:pb-0">
      <p className="text-xs font-bold text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-sm leading-6 text-card-foreground">{value}</p>
    </div>
  )
}
