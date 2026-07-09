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

/**
 * Counter-verified stamps — Nabaperks' anti-fraud method. Describing the
 * mechanism (in plain lowercase, not a hero-level brand push) makes it a citable
 * answer for "how are digital loyalty stamps verified / can they be faked" and an
 * E-E-A-T moat. The five checks read as a numbered list (semantic, AI-liftable).
 */
const checks: { icon: IconGlyph; title: string; body: string }[] = [
  {
    icon: QrCode01Icon,
    title: "Venue QR verified",
    body: "Each stamp is tied to your one permanent venue QR and the membership that claims it, so every claim lands with a traceable source.",
  },
  {
    icon: UserCheck01Icon,
    title: "Membership verified",
    body: "We confirm it's a real saved card on your programme before the stamp lands.",
  },
  {
    icon: Calendar03Icon,
    title: "One per UK date",
    body: "A hard cap of one stamp per customer per UK calendar date stops self-stamping and stamping mates twice.",
  },
  {
    icon: Location01Icon,
    title: "Unusual location flag",
    body: "Optional location checks flag stamps claimed far from your counter, so off-site collecting stands out.",
  },
  {
    icon: GiftIcon,
    title: "Reward checked at redemption",
    body: "A reward is checked when they claim it — not waved through from a screenshot of a full card.",
  },
]

export function CounterVerifiedStamp() {
  return (
    <ContrastBand id="anti-fraud">
      <div className="max-w-[46ch]">
        <MonoTag tone="sun">Built-in anti-fraud</MonoTag>
        <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,2.85rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
          Stamps confirmed at the counter.
        </h2>
        <p className="mt-4 text-[0.98rem] leading-relaxed text-pretty text-paper/80 sm:text-base">
          Every stamp is checked against your physical venue QR, the
          customer&apos;s membership, your live account, a{" "}
          <strong className="font-bold text-paper">
            one-stamp-per-customer-per-UK-date cap
          </strong>
          , and optional unusual-location checks. Fraud is designed out — not
          &ldquo;mitigated&rdquo;.
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
        summary="How paper and wallet passes get faked"
        className="mt-5 border-paper/30 bg-transparent"
      >
        <p className="mt-4 max-w-[60ch] border-t-2 border-dashed border-paper/25 pt-5 text-sm leading-relaxed text-pretty text-paper/70 sm:mt-8">
          A paper card is trivially faked — stamps bought online, self-stamping,
          a quick photocopy — and most are lost before they&rsquo;re ever
          redeemed. Wallet-pass rivals stamp from a sharable staff code.
          Nabaperks checks every stamp where it&rsquo;s claimed, so the phone
          never crosses the counter.
        </p>
      </ReadMore>
    </ContrastBand>
  )
}
