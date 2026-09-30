import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { ReceiptCard, VenueMark } from "@/components/brand"
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

  // Guests first: the two guest actions, with the venue team's sign-in as a
  // small footer link rather than a competing button.
  return (
    <CustomerShell>
      <ReceiptCard edge className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <VenueMark size={56} name="Nabaperks" caption="Welcome" />
          <div className="grid gap-1">
            <h1 className="text-2xl leading-tight font-extrabold text-balance">
              Your loyalty cards
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Scan the QR at a venue to get a stamp, or open the cards you
              already have.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Button asChild size="lg">
            <Link href="/scan">Scan a venue QR</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/home/login">{OPEN_MY_CARDS_LABEL}</Link>
          </Button>
        </div>

        <p className="border-t-2 border-dashed border-foreground/25 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan the QR at a venue to get your first stamp.
        </p>

        <p className="text-center text-xs leading-5 text-muted-foreground">
          Run a venue?{" "}
          <Link
            href="/login"
            className="focus-ring inline-flex min-h-11 items-center font-bold underline underline-offset-4"
          >
            Venue sign-in
          </Link>
        </p>
      </ReceiptCard>
    </CustomerShell>
  )
}
