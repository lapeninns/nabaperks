import {
  Analytics01Icon,
  CakeIcon,
  CheckmarkCircle02Icon,
  GiftIcon,
  PrinterIcon,
  QrCode01Icon,
  UserGroup02Icon,
} from "@hugeicons/core-free-icons"

import { Icon, IconRoundel, MonoTag, SectionHeader } from "@/components/brand"
import type { IconGlyph } from "@/components/brand/icon"
import { Section } from "@/components/layout"
import { FEATURES, type MarketingFeatureKey } from "@/lib/marketing/facts"

import { SnapRail, SnapRailItem } from "./snap-rail"

const FEATURE_GLYPH: Record<MarketingFeatureKey, IconGlyph> = {
  "no-app-qr": QrCode01Icon,
  "mystery-rewards": GiftIcon,
  dashboard: Analytics01Icon,
  birthdays: CakeIcon,
  referrals: UserGroup02Icon,
  posters: PrinterIcon,
}

/**
 * The complete feature set as six launch cards: glyph, tab, spoken title, the
 * checklist it ships with, and the objection it removes printed as the card's
 * mono footer. On phones the cards ride the snap rail; from `sm` up they grid
 * two-across, then three. All copy renders as semantic server HTML so search
 * and answer engines see the same substance a person does.
 */
export function FeaturesListicle() {
  return (
    <Section id="features" size="dense">
      <SectionHeader
        eyebrow="What's included"
        title="Everything set up before you go live"
        description="Six parts of the launch, each tied to a practical objection it removes."
      />
      <div className="pt-5 sm:pt-6">
        <SnapRail
          label="The six parts of the launch"
          className="sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature, index) => (
            <SnapRailItem
              key={feature.key}
              className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <IconRoundel
                  size="md"
                  tone={index === 0 ? "primary" : "secondary"}
                  icon={FEATURE_GLYPH[feature.key]}
                />
                <MonoTag>{feature.tab}</MonoTag>
              </div>
              <h3 className="text-lg leading-snug font-extrabold text-foreground">
                {feature.title}
              </h3>
              <ul className="grid content-start gap-2">
                {feature.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Icon
                      icon={CheckmarkCircle02Icon}
                      size={17}
                      className="mt-0.5 shrink-0 text-reward"
                    />
                    <span className="text-sm leading-6 text-muted-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mono-id mt-auto border-t-2 border-dashed border-border pt-2.5 text-primary uppercase">
                {feature.removes}
              </p>
            </SnapRailItem>
          ))}
        </SnapRail>
      </div>
    </Section>
  )
}
