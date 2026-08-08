"use client"

import { useEffect, useState } from "react"

import {
  PUB_GUIDE_HERO,
  PUB_GUIDE_SECTIONS,
  type PubGuideSectionId,
} from "@/lib/marketing/facts"
import { useHydrated } from "@/lib/motion/use-hydrated"
import { cn } from "@/lib/utils"

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
/**
 * The marketing header height in px, from `--marketing-header-h`.
 *
 * One number drives the anchor offset, both sticky asides and this observer
 * band; reading it here keeps the rail's active section in step with where an
 * anchor jump actually lands. Falls back to the token's own 68px if the
 * property is missing, so a stylesheet failure degrades to the old constant
 * rather than to zero.
 */
function marketingHeaderPx(): number {
  if (typeof window === "undefined") return 68

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--marketing-header-h")
    .trim()
  const rem = Number.parseFloat(raw)

  if (!Number.isFinite(rem)) return 68

  return raw.endsWith("rem") ? Math.round(rem * 16) : Math.round(rem)
}

export function GuideSpine() {
  const hydrated = useHydrated()
  const [activeId, setActiveId] = useState<PubGuideSectionId>(
    PUB_GUIDE_SECTIONS[0].id
  )
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const targets = PUB_GUIDE_SECTIONS.map((section) =>
      document.getElementById(section.id)
    ).filter((element): element is HTMLElement => element !== null)

    if (targets.length === 0) return

    // A thin band below the sticky header: whichever section sits highest
    // inside it owns the rail. Cheaper and steadier than a scroll listener.
    //
    // The band's top edge reads --marketing-header-h rather than repeating 96,
    // which is what made this the fifth different number for one 68px header
    // (01#5).
    const observer = new IntersectionObserver(
      (entries) => {
        const inBand = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]

        if (inBand) setActiveId(inBand.target.id as PubGuideSectionId)
      },
      { rootMargin: `-${marketingHeaderPx()}px 0px -70% 0px` }
    )

    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      aria-label={PUB_GUIDE_HERO.jumpLabel}
      className="lg:sticky lg:top-[calc(var(--marketing-header-h)+0.75rem)] lg:self-start"
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
        <span className="mono-meta text-muted-foreground">
          {PUB_GUIDE_HERO.jumpLabel}
        </span>
        <span aria-hidden="true" className="mono-id text-primary uppercase">
          {open ? "Close" : `${PUB_GUIDE_SECTIONS.length} sections`}
        </span>
      </button>

      <p className="mono-meta hidden text-muted-foreground lg:block">
        {PUB_GUIDE_HERO.jumpLabel}
      </p>

      <ol
        id="pub-guide-spine-list"
        className={cn(
          "mt-3 grid gap-0.5 lg:mt-3 lg:block",
          hydrated && !open ? "hidden lg:block" : "grid"
        )}
      >
        {PUB_GUIDE_SECTIONS.map((section, index) => {
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
