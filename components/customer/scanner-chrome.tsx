import type { ReactNode } from "react"
import { Camera01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { Eyebrow, IconRoundel } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"

type ButtonVariant = React.ComponentProps<typeof Button>["variant"]

/**
 * The scanner's standing chrome, owned once (CUS 02#62).
 *
 * `customer-qr-scanner-loader.tsx` and `customer-qr-scanner.tsx` are two files
 * by necessity — the loader is the light fallback that must not pull the
 * html5-qrcode chunk — and they used to re-declare the same header block and
 * the same exit pair verbatim. That duplication has already drifted twice in
 * this repo's own commit history: once on the button variants (the vermillion
 * slot moved between the two buttons as the chunk landed) and once on
 * `sm:grid-cols-2`, which the loaded scanner dropped and the loader kept, so
 * above 640px the fallback drew a two-up row that the loaded state re-stacked.
 * Both were first-paint jumps, and both were fixed by hand in two places.
 *
 * The variants stay CALLER-owned rather than moving in here, because
 * `customer-error-boundaries` pins the camera-error demotion as a source
 * expression in `customer-qr-scanner.tsx` ("Back to start must demote to ghost
 * in the camera-error state"). The scanner still decides; this file just draws
 * the same row either way.
 *
 * The intro SENTENCE is likewise passed in, not held here: `customer-p2-polish`
 * CUS-P2-11 asserts the barista line appears in `customer-qr-scanner.tsx`
 * itself, and the loader cannot import a constant from the scanner without
 * dragging the chunk it exists to defer. So the markup is shared and the string
 * is stated twice — with a contract assertion added to CUS-P2-11 that the two
 * statements are identical, which is the part that could actually drift.
 */
export function ScannerIntro({ description }: { description: ReactNode }) {
  return (
    <div className="grid gap-3">
      <IconRoundel icon={Camera01Icon} iconSize={22} tone="accent" />
      <div className="grid gap-1.5">
        <Eyebrow>Customer scanner</Eyebrow>
        <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
          Scan venue QR
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/**
 * The two standing exits, stacked at every width.
 *
 * No `sm:grid-cols-2`: the customer column is capped at 410px, so the split
 * fired on a VIEWPORT width the container never sees — measured at an 800px
 * viewport it produced two 173px buttons inside a 358px row, i.e. narrower
 * targets on a bigger screen for a pair of full sentences (CUS 02#6).
 *
 * Rendered only when the member has no tab bar. Signed in, the fixed tab bar is
 * already the navigation and a second exit pair under the viewfinder was ~100px
 * of duplicate chrome, one half of which sent the member out to the marketing
 * switchboard (CUS 02#60).
 */
export function ScannerExits({
  startVariant = "secondary",
  cardsVariant,
}: {
  readonly startVariant?: ButtonVariant
  readonly cardsVariant?: ButtonVariant
}) {
  return (
    <div className="grid gap-3">
      <Button asChild variant={startVariant} className="w-full">
        <Link href="/start">Back to start</Link>
      </Button>
      <Button asChild variant={cardsVariant} className="w-full">
        <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
      </Button>
    </div>
  )
}
