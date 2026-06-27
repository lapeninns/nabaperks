import {
  BubbleTea01Icon,
  Coffee02Icon,
  DeliveryBox01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"

import type { IconGlyph } from "@/components/brand"

/**
 * Persona chapters — serve the Solution-Aware "for [my venue type]" cluster on
 * the hub, each addressable by its own anchor and linking to a Stage-0/1 spoke
 * (built later per the SEO roadmap). Hooks name the persona's specific job.
 *
 * `spoke` paths are the planned spoke URLs; they 404 until built, so the section
 * renders them as plain text until SHOW_PERSONA_SPOKES is switched on.
 */
export const SHOW_PERSONA_SPOKES = false

export type Persona = {
  id: string
  icon: IconGlyph
  title: string
  hook: string
  spoke: string
}

export const personas: readonly Persona[] = [
  {
    id: "cafes",
    icon: Coffee02Icon,
    title: "Cafes & coffee shops",
    hook: "Turn the daily-habit visit into a stamp. The card opens before the coffee cools — no app, no queue at the till.",
    spoke: "/loyalty-for-cafes",
  },
  {
    id: "takeaways",
    icon: DeliveryBox01Icon,
    title: "Takeaways & chippies",
    hook: "Works on any till, even cash-only. No POS to buy, no number to type — just the QR by the counter.",
    spoke: "/loyalty-for-takeaways",
  },
  {
    id: "pubs",
    icon: Store01Icon,
    title: "Pubs & bars",
    hook: "Reward regulars without an app or a CRM. One venue QR covers the bar, the tables and the takeaway hatch.",
    spoke: "/loyalty-for-pubs",
  },
  {
    id: "dessert",
    icon: BubbleTea01Icon,
    title: "Dessert & bubble tea",
    hook: "A simple threshold plus an optional mystery reward — the kind of treat regulars come back to unlock.",
    spoke: "/loyalty-for-dessert-shops",
  },
]
