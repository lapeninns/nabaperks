import Link from "next/link"
import { redirect } from "next/navigation"

import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { resolveLaunchDestination } from "@/lib/launch/resolve"

export const metadata = {
  title: "Open Nabaperks",
}

export default async function StartPage() {
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

        <div className="grid gap-2">
          <Button asChild size="lg">
            <Link href="/scan">Scan a QR</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/home/login">Open my cards</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="justify-self-center text-muted-foreground"
          >
            <Link href="/login">Merchant sign-in</Link>
          </Button>
        </div>

        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp —
          your first card is created automatically.
        </p>
      </ReceiptCard>
    </CustomerShell>
  )
}
