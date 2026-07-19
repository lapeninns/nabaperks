import Link from "next/link"

import { MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { GUIDES } from "@/components/marketing/guides/guides-data"

const INTENT_LABELS = [
  "No-app alternative",
  "Reward planning",
  "Paper vs QR",
] as const

/** Pub-focused spokes that answer earlier research and comparison questions. */
export function LandingGuides() {
  return (
    <Section id="guides" size="dense">
      <SectionHeader
        eyebrow="Practical pub loyalty guides"
        title="Research the approach before you start"
        description="Straight answers on customer friction, reward design and the trade-offs between paper and a browser-based QR card."
      />
      <ul className="grid gap-4 pt-5 sm:pt-6 lg:grid-cols-3">
        {GUIDES.map((guide, index) => (
          <li
            key={guide.slug}
            className="grid content-start gap-3 border-t-2 border-ink pt-4"
          >
            <MonoTag className="justify-self-start">
              {INTENT_LABELS[index]}
            </MonoTag>
            <h3 className="text-lg leading-snug font-extrabold text-foreground">
              {guide.title}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {guide.description}
            </p>
            <Link
              href={guide.path}
              className="focus-ring mt-auto justify-self-start rounded-sm text-sm font-bold text-primary underline underline-offset-4"
            >
              Read the guide
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
