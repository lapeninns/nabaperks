import {
  Calendar03Icon,
  GiftIcon,
  Location01Icon,
  QrCode01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import type { IconGlyph } from "@/components/brand"

/**
 * The Counter-Verified Stamp — Nabaperks' named anti-fraud method. Naming the
 * mechanism turns it into a citable entity for AI answers ("how are digital
 * loyalty stamps verified / can they be faked") and an E-E-A-T moat. The five
 * checks read as a numbered list (semantic, AI-liftable). Server component.
 */
const checks: { icon: IconGlyph; title: string; body: string }[] = [
  {
    icon: QrCode01Icon,
    title: "Venue QR verified",
    body: "The stamp only counts when it comes from your one permanent venue QR — not a screenshot or a shared link.",
  },
  {
    icon: UserCheck01Icon,
    title: "Membership verified",
    body: "The server confirms it’s a real saved card on your programme, with your billing active, before it records anything.",
  },
  {
    icon: Calendar03Icon,
    title: "One per UK date",
    body: "A hard cap of one stamp per customer per UK calendar date stops self-stamping and stamping mates twice.",
  },
  {
    icon: Location01Icon,
    title: "GPS-anomaly flag",
    body: "Optional location signals flag stamps claimed far from your counter, so off-site collecting stands out.",
  },
  {
    icon: GiftIcon,
    title: "Rewards live-checked",
    body: "A reward is verified on the server at redemption — not waved through from a screenshot of a full card.",
  },
]

export function CounterVerifiedStamp() {
  return (
    <section
      id="anti-fraud"
      className="my-14 scroll-mt-24 border-y-2 border-ink bg-ink text-paper sm:my-20"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-16">
        <div className="max-w-[46ch]">
          <MonoTag tone="sun">Built-in anti-fraud</MonoTag>
          <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,2.85rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
            The Counter-Verified Stamp.
          </h2>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-pretty text-paper/80 sm:text-base">
            Every stamp is checked on our server against the physical venue QR,
            the customer’s membership, your billing, a{" "}
            <strong className="font-bold text-paper">one-stamp-per-customer-per-UK-date
            cap</strong>, and optional GPS-anomaly signals. Fraud is designed
            out — not “mitigated”.
          </p>
        </div>

        <ol className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check, index) => (
            <li
              key={check.title}
              className="border-t-2 border-dashed border-paper/25 pt-4"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-paper/30 text-seal">
                  <Icon icon={check.icon} size={18} strokeWidth={2.25} />
                </span>
                <p className="font-mono text-[0.7rem] font-bold tracking-[0.1em] text-seal uppercase">
                  Check {String(index + 1).padStart(2, "0")}
                </p>
              </div>
              <h3 className="mt-3 text-lg font-extrabold">{check.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper/65">
                {check.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-[60ch] border-t-2 border-dashed border-paper/25 pt-5 text-sm leading-relaxed text-pretty text-paper/70">
          A paper card is trivially faked — stamps bought online, self-stamping,
          a quick photocopy — and most are lost before they’re ever redeemed.
          Wallet-pass rivals stamp from a sharable staff code. Nabaperks checks
          every stamp where it’s claimed, so the phone never crosses the counter.
        </p>
      </div>
    </section>
  )
}
