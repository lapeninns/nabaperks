import Link from "next/link"

import { EmptyState, MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { JOIN_WELCOME_HOW_IT_WORKS } from "@/lib/customer/experience/copy"

export function HomeEmptyState() {
  return (
    <EmptyState
      title="No cards yet"
      description="Scan a venue QR at the counter and your first card will appear here."
      actions={
        <ReceiptCard className="w-full max-w-xl text-left" padding="sm">
          <div className="grid gap-4">
            <MonoTag tone="ink">How it works</MonoTag>
            <ol className="grid gap-3">
              {JOIN_WELCOME_HOW_IT_WORKS.map((step, index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-3">
                  <span className="grid size-8 place-items-center rounded-full border-2 border-ink bg-primary font-mono text-xs font-extrabold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-sm leading-6 font-bold">
              Ask for the Nabaperks QR when you are at the counter.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href="/scan">Scan venue QR</Link>
            </Button>
          </div>
        </ReceiptCard>
      }
    />
  )
}
