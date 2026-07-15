import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"

import { BenefitPoint } from "./benefit-point"

const legalLinkClass =
  "focus-ring rounded-sm font-semibold text-foreground underline underline-offset-4 transition-colors hover:text-primary"

/**
 * Loyalty and marketing kept separate — neutralises the data-privacy and
 * notification-fatigue objections and turns UK soft opt-in (marketing needs a
 * separate lawful basis from loyalty) into a citable trust asset. Server
 * component.
 */
export function SeparateMarketing() {
  return (
    <Section
      id="separate-marketing"
      className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center lg:gap-8"
    >
      <div>
        <MonoTag tone="plain">Marketing by choice</MonoTag>
        <h2 className="mt-4 max-w-[18ch] text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          Customers earn stamps without joining a marketing list.
        </h2>
        <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-pretty text-muted-foreground">
          Loyalty and marketing stay separate, so collecting stamps never signs
          anyone up for promotions — and you won&apos;t spam your regulars to
          keep them.
        </p>
      </div>

      {/* 2-up on phones (short bodies pack cleanly); single column from `sm`
          where the lg two-column section split takes over. */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-1 sm:gap-5">
        <BenefitPoint title="Loyalty ≠ a marketing list">
          A customer can collect and redeem rewards without ever agreeing to
          promotional messages. The two choices are recorded separately.
        </BenefitPoint>
        <BenefitPoint title="Real UK GDPR, not just a toggle">
          Marketing keeps its own lawful basis (soft opt-in), the way the ICO
          expects — not bundled into the act of joining your card.
        </BenefitPoint>
        <BenefitPoint title="Scoped to your venue">
          A card collects only at your counter, and the data stays yours — kept
          secure, never sold on.
        </BenefitPoint>
        <BenefitPoint title="Plain-English terms">
          No dark patterns. Read exactly what’s collected in our{" "}
          <Link href="/privacy" className={legalLinkClass}>
            Privacy
          </Link>{" "}
          and{" "}
          <Link href="/merchant-terms" className={legalLinkClass}>
            Terms
          </Link>
          .
        </BenefitPoint>
      </ul>
    </Section>
  )
}
