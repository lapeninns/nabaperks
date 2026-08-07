import type { ReactNode } from "react"

export type HarnessIndexSection = {
  readonly id: string
  readonly label: string
}

/**
 * Chip row of in-page anchors for the harness pages. Both the skeletons (12
 * sections) and states (4) pages already gave every section an `id` and
 * `scroll-mt-6` with nothing linking to them, so screenshotting one skeleton
 * meant scrolling past eleven.
 */
export function HarnessIndex({
  label = "Sections",
  sections,
}: {
  readonly label?: string
  readonly sections: readonly HarnessIndexSection[]
}): ReactNode {
  return (
    <nav
      aria-label={label}
      className="surface-card-flat sticky top-2 z-20 flex flex-wrap gap-2 p-3"
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="focus-ring tap-floor mono-meta inline-flex h-9 shrink-0 items-center rounded-full border-2 border-ink bg-card px-3.5 tracking-meta whitespace-nowrap text-ink-soft normal-case hover:bg-secondary"
        >
          {section.label}
        </a>
      ))}
    </nav>
  )
}
