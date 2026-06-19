import Link from "next/link"

import { Eyebrow, ReceiptCard } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getMerchantJoinContext } from "@/lib/customer/join"

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
    return <UnavailableTerms merchantSlug={merchantSlug} />
  }

  if (!context) return <UnavailableTerms merchantSlug={merchantSlug} />

  const { merchant, loyaltyCard } = context
  const contact = [merchant.email, merchant.phone].filter(Boolean).join(" · ")

  return (
    <CustomerShell className="grid content-center gap-6">
      <section className="grid gap-3 text-center">
        <Eyebrow>Reward terms</Eyebrow>
        <h1 className="text-3xl leading-tight font-extrabold text-balance">
          {merchant.business_name} loyalty terms
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          These MVP terms are shown to customers before participation and must
          be reviewed before launch.
        </p>
      </section>

      <ReceiptCard edge className="grid gap-4">
        <Term
          label="Reward"
          value="A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp."
        />
        <Term
          label="Earning rule"
          value={`Collect ${loyaltyCard.stamps_required} visit stamps from the venue QR. One stamp may be issued per UK date.`}
        />
        <Term
          label="Stamps needed"
          value={`${loyaltyCard.stamps_required} stamps`}
        />
        <Term
          label="Minimum spend"
          value="Minimum spend is applied by the assigned reward, if that reward has one."
        />
        <Term
          label="Redemption"
          value="The assigned reward can be collected from the next UK business day after it is revealed. Show your reward QR at the counter and the venue team scans it to collect."
        />
        <Term
          label="Exclusions"
          value={
            loyaltyCard.reward_terms || "No additional exclusions configured."
          }
        />
        <Term
          label="Fraud and abuse"
          value="The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected."
        />
        <Term
          label="Merchant contact"
          value={contact || "Ask the venue team"}
        />
      </ReceiptCard>

      <StatusBanner title="Review required" tone="warning">
        These terms support pilot operation only. Legal, promotional, and data
        protection wording needs human review before public launch.
      </StatusBanner>

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

function UnavailableTerms({ merchantSlug }: { merchantSlug: string }) {
  return (
    <CustomerShell className="grid content-center gap-6">
      <StatusBanner title="Terms unavailable" tone="neutral">
        Ask the venue team for the current loyalty QR before joining.
      </StatusBanner>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={`/m/${merchantSlug}`}>Back to loyalty card</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href="/privacy">Privacy notice</Link>
        </Button>
      </div>
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
