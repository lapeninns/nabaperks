import Link from "next/link"
import { QrCode01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, IconRoundel, MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * Forward-looking how-it-works for the *no-cards* dashboard. Deliberately not
 * the join wizard's narration, which is past-tense ("You scanned the venue QR")
 * for someone mid-join — that contradicts an empty wallet where nothing has been
 * scanned or saved yet. Here we tell the customer what to do next, in order.
 * Local to this surface by design — do not hoist to the shared copy module.
 */
export const HOME_EMPTY_HOW_IT_WORKS = [
  "Find the Nabaperks QR at the counter, then scan it here",
  "Save the card to your number — one text, no app",
  "Collect a stamp on every visit",
] as const

export const HOME_EMPTY_HOW_IT_WORKS_LABEL = "How it works" as const

export function HomeEmptyState() {
  return (
    <EmptyState
      title="Scan a venue QR to start a card"
      description="Cards you collect live here. You don't have any yet."
      icon={QrCode01Icon}
      actions={
        <ReceiptCard className="w-full max-w-xl text-left" padding="sm">
          <div className="grid gap-4">
            <MonoTag tone="ink">{HOME_EMPTY_HOW_IT_WORKS_LABEL}</MonoTag>
            <ol className="grid gap-3">
              {HOME_EMPTY_HOW_IT_WORKS.map((step, index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-3">
                  <IconRoundel
                    size="sm"
                    tone="primary"
                    className="font-mono text-xs font-extrabold"
                  >
                    {index + 1}
                  </IconRoundel>
                  <span className="text-sm leading-6 text-muted-foreground">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <Button asChild size="lg" className="w-full">
              <Link href="/scan">Scan venue QR</Link>
            </Button>
          </div>
        </ReceiptCard>
      }
    />
  )
}
