import Link from "next/link"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

export default function NfcCardNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">
      <ReceiptCard className="grid w-full max-w-md gap-4" edge>
        <PageTitle
          eyebrow="NFC card"
          title="Card not found"
          description="That NFC card design is not available, or the venue QR link is missing."
          titleClassName="sm:text-2xl"
        />
        <Button asChild variant="outline" className="w-fit">
          <Link href="/app/qr">Back to QR</Link>
        </Button>
      </ReceiptCard>
    </main>
  )
}
