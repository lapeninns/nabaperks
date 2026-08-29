import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { PresentCodeButton } from "@/components/customer/present-code-button"
import { QrFrame } from "@/components/loyalty"
import { buildQrMatrix } from "@/components/marketing/landing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The counter-presentation overlay (CUS 02#33), which had no harness.
 *
 * `PresentCodeButton` ships on `/reward/[rewardId]` and `/pass/[entitlementId]`,
 * both of which need live member data, so the overlay it opens had never been
 * looked at in a browser — the finding stayed partial on exactly that gap.
 *
 * This mounts the REAL `PresentCodeButton` and the REAL `QrFrame` rather than
 * copying their markup, so what the harness shows is what ships. Five other
 * harnesses copy the markup they stand in for, and that drift already cost two
 * wrong conclusions this campaign.
 *
 * The code itself is a marketing-style matrix rather than a member's pass PNG,
 * because the thing under test is the overlay's geometry, not the payload.
 */
export default function PresentCodeHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const matrix = buildQrMatrix("https://nabaperks.com/pass/harness-entitlement")

  const code = (
    <svg
      viewBox={`0 0 ${matrix.size} ${matrix.size}`}
      role="img"
      aria-label="Harness pass code"
      className="aspect-square w-full"
      shapeRendering="crispEdges"
    >
      <path d={matrix.path} fill="currentColor" />
    </svg>
  )

  return (
    <main className="mx-auto grid w-full max-w-customer gap-5 px-4 py-8">
      <PageTitle
        eyebrow="Harness"
        title="Present code overlay"
        description="The counter-presentation mode a member opens from a reward or pass."
      />
      <div className="surface-card grid gap-4 p-5">
        <QrFrame
          label="Harness pass code"
          className="mx-auto w-full max-w-[16rem]"
        >
          {code}
        </QrFrame>
        <PresentCodeButton
          label="Show at the counter"
          title="Show this to the bar"
          caption="Staff scan this to collect your reward."
        >
          {code}
        </PresentCodeButton>
      </div>
    </main>
  )
}
