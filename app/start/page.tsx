import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { resolveLaunchDestination } from "@/lib/launch/resolve"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Open Nabaperks",
}

export default async function StartPage() {
  await connection()
  const destination = await resolveLaunchDestination()

  if (destination) {
    redirect(destination)
  }

  return (
    <CustomerShell>
      <ReceiptCard edge className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <VenueMark size={56} name="Nabaperks" caption="Welcome" />
          <div className="grid gap-1">
            <Eyebrow>Nabaperks</Eyebrow>
            <h1 className="text-2xl leading-tight font-extrabold text-balance">
              Welcome to Nabaperks
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Open your loyalty cards, or sign in to run your venue.
            </p>
          </div>
        </div>

        {/* `gap-3`: two full-width 48px keys 8px apart do not read as two
            separate targets — the system's own card gap is 14px. */}
        <div className="grid gap-3">
          <Button asChild size="lg">
            <Link href="/scan">Scan a QR</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/home/login">{OPEN_MY_CARDS_LABEL}</Link>
          </Button>
        </div>

        {/* Running a venue is a different audience, not a lesser version of
            this one — so it gets its own labelled lane below the rule rather
            than a 36px ghost link buried under the customer keys. */}
        {/* border-line, not border-foreground/25. DESIGN.md · Elevation & Depth:
            "Dashed lines come in two tones only" — and a receipt rule inside a
            ReceiptCard is --w-line's first named use. */}
        <div className="grid justify-items-center gap-2 border-t-2 border-dashed border-line pt-4">
          <p className="mono-meta text-muted-foreground">Running a venue?</p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Merchant sign-in</Link>
          </Button>
        </div>

        <p className="text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp —
          your first card is created automatically.
        </p>
      </ReceiptCard>
    </CustomerShell>
  )
}
