import Link from "next/link"

import { Button } from "@/components/ui/button"

export type LegalRelatedLink = {
  readonly href: string
  readonly label: string
}

/**
 * LegalRelatedLinks — cross-document navigation for the five interlinked legal
 * pages, in ONE treatment.
 *
 * It previously rendered three different ways: a two-button row on /terms, a
 * single `w-fit` button on /privacy, and a variable-length wrapped row on
 * /cookies, /merchant-terms and /data-processing. A reader moving between them
 * had to relearn the affordance on each page.
 */
export function LegalRelatedLinks({
  links,
}: {
  readonly links: readonly LegalRelatedLink[]
}) {
  if (!links.length) return null

  return (
    <nav aria-label="Related legal documents" className="flex flex-wrap gap-3">
      {links.map((link) => (
        <Button key={link.href} asChild variant="secondary">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </nav>
  )
}
