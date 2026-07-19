"use client"

import { useState } from "react"
import {
  Analytics01Icon,
  CakeIcon,
  CheckmarkCircle02Icon,
  GiftIcon,
  PrinterIcon,
  QrCode01Icon,
  UserGroup02Icon,
} from "@hugeicons/core-free-icons"

import { Icon, IconRoundel, SectionHeader } from "@/components/brand"
import type { IconGlyph } from "@/components/brand/icon"
import { Section } from "@/components/layout"
import { FEATURES, type MarketingFeatureKey } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/** Each feature key maps to one Hugeicons glyph (rendered via the brand Icon). */
const FEATURE_GLYPH: Record<MarketingFeatureKey, IconGlyph> = {
  "no-app-qr": QrCode01Icon,
  "mystery-rewards": GiftIcon,
  dashboard: Analytics01Icon,
  birthdays: CakeIcon,
  referrals: UserGroup02Icon,
  posters: PrinterIcon,
}

/**
 * Tabbed feature listicle (the ShipFast listicle pattern, rebuilt in Wet Ink):
 * icon tabs select a feature; the open feature shows its checklist and the
 * pain it removes. Client component for the tab state; content is read from
 * the shared marketing facts. Keyboard-operable via native buttons + roving
 * `aria-selected` tabs.
 */
export function FeaturesListicle() {
  const [selected, setSelected] = useState<MarketingFeatureKey>(FEATURES[0].key)
  const active =
    FEATURES.find((feature) => feature.key === selected) ?? FEATURES[0]

  return (
    <Section id="features">
      <SectionHeader
        eyebrow="What's included"
        title="Everything set up before you go live"
        description="Six things the launch stands up for you. Tap through to see what each one includes."
      />
      <div
        role="tablist"
        aria-label="Features"
        className="mt-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
      >
        {FEATURES.map((feature) => {
          const isActive = feature.key === selected

          return (
            <button
              key={feature.key}
              type="button"
              role="tab"
              id={`feature-tab-${feature.key}`}
              aria-selected={isActive}
              aria-controls={`feature-panel-${feature.key}`}
              onClick={() => setSelected(feature.key)}
              className={cn(
                "focus-ring group flex flex-col items-center gap-2 rounded-lg border-2 px-2 py-3 text-center transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none sm:flex-1",
                isActive
                  ? "border-ink bg-card shadow-sm"
                  : "border-dashed border-border bg-transparent hover:bg-card"
              )}
            >
              <IconRoundel
                size="md"
                tone={isActive ? "primary" : "secondary"}
                icon={FEATURE_GLYPH[feature.key]}
              />
              <span
                className={cn(
                  "mono-meta leading-tight",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {feature.tab}
              </span>
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`feature-panel-${active.key}`}
        aria-labelledby={`feature-tab-${active.key}`}
        className="mt-4 grid gap-4 rounded-lg border-2 border-ink bg-card p-6 shadow-sm sm:p-8"
      >
        <h3 className="text-xl leading-snug font-extrabold text-foreground">
          {active.title}
        </h3>
        <ul className="grid gap-2.5">
          {active.includes.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={18}
                className="mt-0.5 shrink-0 text-reward"
              />
              <span className="text-sm leading-6 text-muted-foreground">
                {item}
              </span>
            </li>
          ))}
        </ul>
        <p className="mono-id border-t-2 border-dashed border-border pt-3 text-primary uppercase">
          {active.removes}
        </p>
      </div>
    </Section>
  )
}
