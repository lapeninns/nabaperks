import Link from "next/link"

import { Icon, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"

import { personas, SHOW_PERSONA_SPOKES } from "./persona-data"

/**
 * Persona chapters — the Solution-Aware "for [my venue type]" cluster, each block
 * addressable by anchor and (once built) linking to its Stage-0/1 spoke. Until
 * the spokes exist, the hook reads as plain text so no link 404s. Server
 * component; mobile-first 1→2→4 column grid.
 */
export function VenuePersonas() {
  return (
    <Section id="for-venues">
      <div className="max-w-[34ch]">
        <MonoTag tone="plain">Built for your venue</MonoTag>
        <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          Made for food &amp; drink — not generic CRM.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
          Same browser card, same counter-verified stamps — tuned to how your
          counter actually runs.
        </p>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {personas.map((persona) => (
          <li
            key={persona.id}
            id={persona.id}
            className="surface-card scroll-mt-24 p-4 sm:p-5"
          >
            <span className="grid size-11 place-items-center rounded-full border-2 border-ink bg-secondary text-foreground">
              <Icon icon={persona.icon} size={22} strokeWidth={2} />
            </span>
            <h3 className="mt-4 text-lg leading-snug font-extrabold text-balance">
              {persona.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {persona.hook}
            </p>
            {persona.live ? (
              <Link
                href={persona.spoke}
                className="mt-3 inline-block font-mono text-[0.68rem] font-bold tracking-[0.06em] text-primary uppercase underline-offset-4 hover:underline"
              >
                {persona.cta ?? "See more"} →
              </Link>
            ) : SHOW_PERSONA_SPOKES ? (
              <Link
                href={persona.spoke}
                className="mt-3 inline-block font-mono text-[0.68rem] font-bold tracking-[0.06em] text-primary uppercase underline-offset-4 hover:underline"
              >
                See more →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}
