import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon } from "@/components/brand"
import { formatOfferPassDate } from "@/components/loyalty/offer-pass"
import type { CustomerOfferPass } from "@/lib/customer/offer-pass"

/** Independent of the card/reward link, including when the pass has no QR. */
export function OfferPassRail({ pass }: { pass: CustomerOfferPass }) {
  const label = pass.presentable ? "Show pass QR" : "View pass"
  return (
    <Link
      href={`/pass/${pass.entitlementId}`}
      aria-label={`${label}, ${pass.discountPercent}% discount pass at ${pass.venueName}`}
      data-reward-ticket="offer-pass"
      className="focus-ring grid min-h-22 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-2 border-ink bg-card p-3 text-foreground shadow-sm"
    >
      <span className="text-3xl leading-none font-extrabold tracking-tight">
        {pass.discountPercent}
        <span className="text-lg">%</span>
      </span>
      <span className="grid min-w-0 gap-1">
        <Eyebrow>Discount pass</Eyebrow>
        <span className="text-sm leading-5 font-extrabold">{label}</span>
        <span className="mono-id break-words text-muted-foreground">
          {passNote(pass)}
        </span>
      </span>
      <Icon icon={ArrowRight01Icon} size={20} className="text-primary" />
    </Link>
  )
}

function passNote(pass: CustomerOfferPass): string {
  if (pass.state === "not_started") {
    const opens = formatOfferPassDate(pass.validFrom)
    return opens ? `Opens ${opens}` : "Opens soon"
  }
  if (pass.state === "revoked") return "Withdrawn"
  if (pass.state === "expired") return "Finished"
  if (!pass.presentable) return "Not available just now"
  const closes = formatOfferPassDate(pass.validTo)
  return closes ? `Until ${closes}` : "Ready to use"
}
