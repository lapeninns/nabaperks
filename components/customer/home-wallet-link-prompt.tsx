import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

export function HomeWalletLinkPrompt() {
  return (
    <ReceiptCard className="grid gap-3" data-testid="wallet-link-prompt">
      <MonoTag tone="cobalt">Your wallet</MonoTag>
      <h2 className="text-base leading-tight font-extrabold">
        Used your phone number before?
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Verify your original number to bring your stamps and rewards together.
        You can then sign in to the same wallet with your phone or email.
      </p>
      <Button asChild variant="secondary">
        <Link href="/home/profile#add-phone">Link my phone number</Link>
      </Button>
    </ReceiptCard>
  )
}
