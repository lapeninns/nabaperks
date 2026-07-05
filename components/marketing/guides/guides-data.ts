import { ROUTES } from "@/lib/marketing/facts"

/**
 * The pub-led guide spokes. One registry so each guide can render the other two
 * as "related" links (spoke-to-spoke) and the hub can list them all
 * (hub-to-spoke), per the PDF hub-and-spoke blueprint.
 */
export type GuideMeta = {
  href: string
  /** Full guide H1 / link title. */
  title: string
  /** Short nav/related-card label. */
  nav: string
  /** One-line summary for related-guide cards. */
  summary: string
  /** ISO dates (real, git-grounded) → Article datePublished/dateModified +
   * the visible "Published … · updated …" dateline. Bump dateModified when a
   * guide's body materially changes. */
  datePublished: string
  dateModified: string
}

export const GUIDES: readonly GuideMeta[] = [
  {
    href: ROUTES.guides.bestIdeas,
    title: "Best loyalty ideas for pubs",
    nav: "Best loyalty ideas for pubs",
    summary:
      "Reward shapes that suit a pub — a simple threshold, quieter-day perks — and which ones bring regulars back.",
    datePublished: "2026-06-27",
    dateModified: "2026-07-05",
  },
  {
    href: ROUTES.guides.rewardRegulars,
    title: "How to reward regulars without an app",
    nav: "Reward regulars without an app",
    summary:
      "Why an app is the wrong ask for a pint, and how a browser-based loyalty card rewards regulars with nothing to install.",
    datePublished: "2026-06-27",
    dateModified: "2026-07-05",
  },
  {
    href: ROUTES.guides.paperVsQr,
    title: "Paper loyalty cards vs QR loyalty for pubs",
    nav: "Paper vs QR loyalty for pubs",
    summary:
      "A side-by-side on loss, fraud, staff time and the data you get back, so you can pick the right card for your bar.",
    datePublished: "2026-06-27",
    dateModified: "2026-07-05",
  },
] as const

export function guideByHref(href: string): GuideMeta | undefined {
  return GUIDES.find((guide) => guide.href === href)
}

export function otherGuides(href: string): GuideMeta[] {
  return GUIDES.filter((guide) => guide.href !== href)
}
