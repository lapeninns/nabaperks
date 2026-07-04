"use client"

import { useEffect, useState, type ReactNode } from "react"

import { useHydrated } from "@/lib/motion/use-hydrated"
import { cn } from "@/lib/utils"

import {
  proofPanelIdFromHash,
  resolveProofActiveId,
} from "./proof-tabs-core"

export type ProofTabPanel = {
  id: string
  label: string
  content: ReactNode
}

const chipClassName = (selected: boolean) =>
  cn(
    "pressable mono-meta focus-ring inline-flex w-full items-center justify-center rounded-full border-2 px-3.5 py-2.5 text-center transition-colors sm:w-auto sm:justify-start sm:py-1.5 sm:whitespace-nowrap",
    "[@media(pointer:coarse)]:min-h-11",
    selected
      ? "border-ink bg-primary text-primary-foreground shadow-xs"
      : "border-line bg-card hover:border-ink hover:bg-accent hover:text-accent-foreground"
  )

/**
 * ProofTabs — chip-switched proof panels, mobile only.
 *
 * Below `lg` a FilterPills-style chip row (`role="group"` + `aria-pressed` —
 * deliberately NOT `role="tablist"`, which would leave visible tabpanel
 * orphans at `lg+` where the chips disappear) shows one panel at a time;
 * inactive panels are CSS-hidden so every word stays server-rendered in the
 * DOM. From `lg` the chip row is gone and all panels render stacked.
 *
 * Hash deep links (`#old-crown`, `#venue-proof`, …) sync after hydration so
 * the server and the client's first paint both default to the first panel —
 * avoiding a useSyncExternalStore snapshot mismatch that could break chip taps.
 */
export function ProofTabs({
  panels,
  label,
}: {
  panels: ProofTabPanel[]
  label: string
}) {
  const hydrated = useHydrated()
  const [selection, setSelection] = useState<{
    forHash: string
    id: string
  } | null>(null)
  const [hash, setHash] = useState("")

  useEffect(() => {
    const readHash = () => setHash(window.location.hash.slice(1))
    readHash()
    window.addEventListener("hashchange", readHash)
    return () => window.removeEventListener("hashchange", readHash)
  }, [])

  const hashPanelId = proofPanelIdFromHash(panels, hash)
  const activeId = resolveProofActiveId({
    panels,
    selection,
    hash,
    hashPanelId,
    honorHash: hydrated,
  })

  if (panels.length === 0 || !activeId) return null

  function selectPanel(panelId: string) {
    setSelection({ forHash: hash, id: panelId })
    requestAnimationFrame(() => {
      document.getElementById(panelId)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      })
    })
  }

  return (
    <div>
      <div
        role="group"
        aria-label={label}
        className="grid gap-2 lg:hidden"
      >
        {panels.map((panel) => {
          const selected = panel.id === activeId
          return (
            <button
              key={panel.id}
              type="button"
              aria-pressed={selected}
              aria-controls={panel.id}
              onClick={() => selectPanel(panel.id)}
              className={chipClassName(selected)}
            >
              {panel.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-6 lg:mt-0 lg:gap-8">
        {panels.map((panel) => (
          <div
            key={panel.id}
            id={panel.id}
            className={cn(
              "scroll-mt-24",
              panel.id !== activeId && "max-lg:hidden"
            )}
          >
            {panel.content}
          </div>
        ))}
      </div>
    </div>
  )
}
