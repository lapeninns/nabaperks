import Link from "next/link"
import { QrCode01Icon } from "@hugeicons/core-free-icons"

import {
  EmptyState,
  IconRoundel,
  MonoTag,
  ReceiptCard,
} from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * Forward-looking how-it-works for the *no-cards* home. Deliberately not the
 * join wizard's narration: nothing has been scanned or saved yet, so this says
 * what to do next, in order, with no speed or simplicity promises. No setup
 * suggestion ever shows here; the scan action is the only thing to do.
 * Local to this surface by design; do not hoist to the shared copy module.
 */
export const HOME_EMPTY_HOW_IT_WORKS = [
  "Find the Nabaperks QR at the venue counter",
  "Scan it and enter the code we send you",
  "Your first stamp goes on your card",
] as const

export const HOME_EMPTY_HOW_IT_WORKS_LABEL = "How it works" as const

export function HomeEmptyState() {
  return (
    <EmptyState
      title="No cards yet"
      description="Scan the QR at a venue to get your first stamp."
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
              <Link href="/scan">Scan a venue QR</Link>
            </Button>
          </div>
        </ReceiptCard>
      }
    />
  )
}
