import { Children, isValidElement, type ReactNode } from "react"

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
  only,
}: {
  readonly label?: string
  readonly sections: readonly HarnessIndexSection[]
  /** Active `?only=` id, if the page is isolating one section. */
  readonly only?: string
}): ReactNode {
  return (
    <nav
      aria-label={label}
      className="surface-card-flat sticky top-2 z-20 flex flex-wrap gap-2 p-3"
    >
      {only ? (
        <a
          href="?"
          className="focus-ring tap-floor mono-meta inline-flex h-9 shrink-0 items-center rounded-full border-2 border-ink bg-ink px-3.5 tracking-meta whitespace-nowrap text-paper normal-case"
        >
          ← Show all {sections.length}
        </a>
      ) : null}
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

/**
 * Renders one `<HarnessSection>` in isolation when `?only=<id>` is set, so a
 * screenshot of a single skeleton does not carry eleven others (ADM 04#72).
 *
 * Filters its own children by their `id` prop rather than threading `only`
 * through every call site: these are server components, so there is no context
 * to read, and sixteen extra props would be sixteen chances to forget one. An
 * unknown id renders nothing but the index, which still carries the "Show all"
 * escape.
 */
export function HarnessSections({
  only,
  children,
}: {
  readonly only?: string
  readonly children: ReactNode
}): ReactNode {
  if (!only) {
    return children
  }

  return Children.toArray(children).filter(
    (child) => isValidElement<{ id?: string }>(child) && child.props.id === only
  )
}
