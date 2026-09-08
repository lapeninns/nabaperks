"use client"

import { useEffect, useState } from "react"

import { PUB_GUIDE_HERO, PUB_GUIDE_SECTIONS } from "@/lib/marketing/facts"
import { useHydrated } from "@/lib/motion/use-hydrated"
import { cn } from "@/lib/utils"

/**
 * What the spine needs of a section: somewhere to jump, and a word for it.
 * Deliberately narrower than `PubGuideSection` so the guide routes, whose
 * sections carry only a heading, can supply the same shape.
 */
export type GuideSpineSection = {
  readonly id: string
  readonly navLabel: string
}

/**
 * The hub's spine — a sticky "on this page" rail from `lg` up, and a collapsed
 * disclosure below it.
 *
 * One `<nav>`, one list, one set of links at every breakpoint: the phone variant
 * toggles the same list rather than rendering a second copy, so there is no
 * duplicate landmark and no duplicate internal links for a crawler to weigh. A
 * sticky overlay on a phone would fight the reading column, hence the
 * disclosure. Scroll-spy is progressive: with JS off, every link still jumps.
 */
export function GuideSpine({
  sections = PUB_GUIDE_SECTIONS,
  jumpLabel = PUB_GUIDE_HERO.jumpLabel,
  className,
}: {
  readonly sections?: readonly GuideSpineSection[]
  readonly jumpLabel?: string
  /**
   * Merged onto the `<nav>` itself, not a wrapper: a wrapping element would
   * become the sticky containing block and pin the rail to its own height.
   */
  readonly className?: string
} = {}) {
  const hydrated = useHydrated()
  const [activeId, setActiveId] = useState<string>(sections[0].id)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)

    if (targets.length === 0) return

    // A thin band below the sticky header: whichever section sits highest
    // inside it owns the rail. Cheaper and steadier than a scroll listener.
    const observer = new IntersectionObserver(
      (entries) => {
        const inBand = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]

        if (inBand) setActiveId(inBand.target.id)
      },
      { rootMargin: "-96px 0px -70% 0px" }
    )

    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav
      aria-label={jumpLabel}
      className={cn("lg:sticky lg:top-24 lg:self-start", className)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pub-guide-spine-list"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          "focus-ring w-full items-center justify-between gap-3 rounded-sm border-2 border-dashed border-line-strong px-3 py-2.5 text-left lg:hidden",
          hydrated ? "flex" : "hidden"
        )}
      >
        <span className="mono-meta text-muted-foreground">{jumpLabel}</span>
        <span aria-hidden="true" className="mono-id text-primary uppercase">
          {open ? "Close" : `${sections.length} sections`}
        </span>
      </button>

      <p className="mono-meta hidden text-muted-foreground lg:block">
        {jumpLabel}
      </p>

      <ol
        id="pub-guide-spine-list"
        className={cn(
          "mt-3 grid gap-0.5 lg:mt-3 lg:block",
          hydrated && !open ? "hidden lg:block" : "grid"
        )}
      >
        {sections.map((section, index) => {
          const active = section.id === activeId

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "focus-ring flex items-baseline gap-2.5 rounded-sm border-l-2 py-1.5 pl-3 transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:border-line-strong hover:text-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mono-id",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm leading-6 font-bold">
                  {section.navLabel}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
