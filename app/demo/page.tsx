import type { Metadata } from "next"
import Link from "next/link"

import { MonoTag, PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

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
          eyebrow="Live demo"
          title="The card your customers would see"
          description={`${PRODUCT.cardLine} ${PRODUCT.posLine} Tap through the 5-stamp cycle below.`}
        />
        <div className="mx-auto w-full max-w-sm pt-8">
          <DemoCard />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-6">
          <MonoTag>No customer app</MonoTag>
          <MonoTag>No wallet pass</MonoTag>
          <MonoTag>Opens from your venue QR</MonoTag>
        </div>
        <p className="mx-auto max-w-md pt-4 text-center text-xs leading-5 text-muted-foreground">
          This page is a demo, not a live card: at a real venue, stamps are
          issued from the venue QR and verified server-side — one claim per
          customer per UK date.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.howItWorks}>See how the launch works</Link>
          </Button>
        </div>
      </Section>
    </MarketingLayout>
  )
}
