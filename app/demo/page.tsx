import type { Metadata } from "next"
import Link from "next/link"

import { MonoTag, PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { Button } from "@/components/ui/button"
import { PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { cn } from "@/lib/utils"

import { DemoCard } from "./demo-card"

/**
 * App-like surface, deliberately unindexed (2026-07-05 GEO audit): robots
 * noindex here plus the `/demo` disallow in robots.txt.
 */
export const metadata: Metadata = {
  title: "Live Demo — the Browser Loyalty Card",
  description: `${PRODUCT.cardLine} Tap through the demo 5-stamp cycle — no app, no wallet pass.`,
  ...PRIVATE_ROUTE_METADATA,
}

export default function DemoPage() {
  return (
    <MarketingLayout>
      <Section width="narrow">
        <PageTitle
          className="justify-items-center text-center"
          eyebrow="Live demo"
          title="The card your customers would see"
          description={`${PRODUCT.cardLine} ${PRODUCT.posLine} Tap through the 5-stamp cycle below.`}
        />
        {/* One wrapper, one gap — the rhythm was four hand-tuned `pt-*`
            values that could not be collapsed or tuned in one place, with the
            alignment flipping from the PageTitle's left axis to centre. */}
        <div className="grid justify-items-center gap-6 pt-8">
          <div className="w-full max-w-sm">
            <DemoCard />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <MonoTag>No customer app</MonoTag>
            <MonoTag>No wallet pass</MonoTag>
            <MonoTag>Opens from your venue QR</MonoTag>
          </div>
          {/* The one line that stops a prospect reading the demo as a live
              card: a deliberate caveat in body type, not fine print. */}
          <p className="max-w-md rounded-lg border-2 border-dashed border-line-strong p-4 text-center text-sm leading-6 text-muted-foreground">
            This page is a demo, not a live card: at a real venue, stamps are
            issued from the venue QR and verified server-side — one claim per
            customer per UK date.
          </p>
          <div className="grid justify-items-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.signup}>Start your launch</Link>
            </Button>
            <Link
              className={cn(MARKETING_TEXT_LINK, "text-foreground")}
              href={ROUTES.howItWorks}
            >
              See how the launch works
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  )
}
