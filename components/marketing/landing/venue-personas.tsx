import Link from "next/link"

import { IconRoundel, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { cn } from "@/lib/utils"

import { personas } from "./persona-data"
import { SNAP_RAIL_ITEM, SnapRail } from "./snap-rail"

/**
 * Persona chapters — the Solution-Aware "for [my venue type]" cluster, each block
 * addressable by anchor and linking to its spoke when `live` is set.
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
          Same browser card, same venue-linked stamp controls — tuned to how your
          counter actually runs.
        </p>
      </div>

      <SnapRail
        as="ul"
        label="Venue types"
        hint="Swipe for all four venue types →"
        className="mt-6"
        trackClassName="gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
      >
        {personas.map((persona) => (
          <li
            key={persona.id}
            id={persona.id}
            className={cn(
              "surface-card scroll-mt-24 p-4 sm:p-5",
              SNAP_RAIL_ITEM,
              "max-sm:w-[min(15rem,68vw)]"
            )}
          >
            <IconRoundel
              icon={persona.icon}
              iconSize={22}
              iconStrokeWidth={2}
            />
            <h3 className="mt-4 text-lg leading-snug font-extrabold text-balance">
              {persona.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {persona.hook}
            </p>
            {persona.live ? (
              <Link
                href={persona.spoke}
                className="mono-meta mt-1 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
              >
                {persona.cta ?? "See more"} →
              </Link>
            ) : null}
          </li>
        ))}
      </SnapRail>
    </Section>
  )
}
