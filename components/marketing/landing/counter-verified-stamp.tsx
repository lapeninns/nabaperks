import {
  Calendar03Icon,
  GiftIcon,
  Location01Icon,
  QrCode01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import type { IconGlyph } from "@/components/brand"
import { ContrastBand } from "@/components/layout"
import { cn } from "@/lib/utils"

import { ReadMore } from "./read-more"
import { SNAP_RAIL_ITEM, SnapRail } from "./snap-rail"

/** The five implemented controls behind a venue-linked stamp claim. */
const checks: { icon: IconGlyph; title: string; body: string }[] = [
  {
    icon: QrCode01Icon,
    title: "Venue QR linked",
    body: "Each stamp is tied to your one permanent venue QR and the membership that claims it, so every claim lands with a traceable source.",
  },
  {
    icon: UserCheck01Icon,
    title: "Saved membership linked",
    body: "The claim must belong to a saved membership on your live programme before the stamp lands.",
  },
  {
    icon: Calendar03Icon,
    title: "One per UK date",
    body: "A hard cap limits each customer to one stamp on a UK calendar date, even if the QR is scanned again.",
  },
  {
    icon: Location01Icon,
    title: "Unusual location flag",
    body: "Optional location checks flag stamps claimed far from your counter, so off-site collecting stands out.",
  },
  {
    icon: GiftIcon,
    title: "Staff-scanned collection",
    body: "Venue staff scan the customer's live reward code and confirm collection in the merchant app.",
  },
]

export function CounterVerifiedStamp() {
  return (
    <ContrastBand id="anti-fraud">
      <div className="max-w-[46ch]">
        <MonoTag tone="sun">Built-in anti-fraud</MonoTag>
        <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,2.85rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
          Controls behind every stamp.
        </h2>
        <p className="mt-4 text-[0.98rem] leading-relaxed text-pretty text-paper/80 sm:text-base">
          Each claim is linked to your venue QR, the customer&apos;s saved
          membership and your live programme, with a{" "}
          <strong className="font-bold text-paper">
            one-stamp-per-customer-per-UK-date cap
          </strong>
          . Optional location checks can flag unusual claims for review.
        </p>
      </div>

      <SnapRail
        as="ol"
        label="The five anti-fraud checks"
        hint="Swipe for all five checks →"
        fadeFrom="ink"
        className="mt-8"
        trackClassName="sm:grid sm:grid-cols-2 sm:gap-x-5 sm:gap-y-6 lg:grid-cols-3 sm:[&>li:last-child]:col-span-2 lg:[&>li:last-child]:col-span-1"
      >
        {checks.map((check, index) => (
          <li
            key={check.title}
            className={cn(
              "border-t-2 border-dashed border-paper/25 pt-4",
              SNAP_RAIL_ITEM,
              "max-sm:w-[min(17rem,76vw)]"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-paper/30 text-seal">
                <Icon icon={check.icon} size={18} strokeWidth={2.25} />
              </span>
              <p className="mono-meta tracking-[0.1em] text-seal">
                Check {String(index + 1).padStart(2, "0")}
              </p>
            </div>
            <h3 className="mt-3 text-lg font-extrabold">{check.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-paper/65">
              {check.body}
            </p>
          </li>
        ))}
      </SnapRail>

      <ReadMore
        summary="Why recorded claims are stronger than paper"
        className="mt-5 border-paper/30 bg-transparent"
      >
        <p className="mt-4 max-w-[60ch] border-t-2 border-dashed border-paper/25 pt-5 text-sm leading-relaxed text-pretty text-paper/70 sm:mt-8">
          Paper cards can be copied, shared or stamped without a visit, and
          they leave no record for the venue. Nabaperks records the venue QR,
          saved membership and UK claim date while the customer keeps hold of
          their phone. Staff scan the live reward code when it is collected.
        </p>
      </ReadMore>
    </ContrastBand>
  )
}
