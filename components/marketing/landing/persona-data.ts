import {
  Coffee02Icon,
  DeliveryBox01Icon,
  DrinkIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"

import type { IconGlyph } from "@/components/brand"
import { CTA, ROUTES } from "@/lib/marketing/facts"

/**
 * Persona chapters — serve the Solution-Aware "for [my venue type]" cluster on
 * the homepage, each addressable by its own anchor. Public copy uses only
 * approved vertical language (pubs, cafes, takeaways, bars/wine bars); the
 * non-approved verticals are deliberately not targeted here.
 *
 * All four personas are live: each spoke route is built, so every card links
 * out with its persona CTA and no link 404s.
 */
export type Persona = {
  id: string
  icon: IconGlyph
  title: string
  hook: string
  spoke: string
  /** True once the spoke route exists — renders the persona CTA link. */
  live?: boolean
  /** CTA label for a live persona (defaults to "See more"). */
  cta?: string
}

export const personas: readonly Persona[] = [
  {
    id: "pubs",
    icon: Store01Icon,
    title: "Pubs & gastropubs",
    hook: "Reward regulars without an app or a CRM. One venue QR covers the bar, the tables and the takeaway hatch — and never slows the bar on a Friday.",
    spoke: ROUTES.pubHub,
    live: true,
    cta: CTA.pub,
  },
  {
    id: "cafes",
    icon: Coffee02Icon,
    title: "Cafes & coffee shops",
    hook: "Turn the daily-habit visit into a stamp. The card opens before the coffee cools — no app, no queue at the till.",
    spoke: ROUTES.cafeHub,
    live: true,
    cta: CTA.cafe,
  },
  {
    id: "takeaways",
    icon: DeliveryBox01Icon,
    title: "Takeaways",
    hook: "Works on any till, even cash-only. No POS to buy, no number to type — just the QR by the counter.",
    spoke: ROUTES.takeawayHub,
    live: true,
    cta: CTA.takeaway,
  },
  {
    id: "bars",
    icon: DrinkIcon,
    title: "Bars & wine bars",
    hook: "Give regulars a reason to choose your bar again. The card lives on their phone, so there is nothing to lose between rounds.",
    spoke: ROUTES.barHub,
    live: true,
    cta: CTA.bar,
  },
]
