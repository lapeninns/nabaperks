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

const FEATURE_GLYPH: Record<MarketingFeatureKey, IconGlyph> = {
  "no-app-qr": QrCode01Icon,
  "mystery-rewards": GiftIcon,
  dashboard: Analytics01Icon,
  birthdays: CakeIcon,
  referrals: UserGroup02Icon,
  posters: PrinterIcon,
}

/**
 * The complete feature set is rendered as semantic server HTML. Visitors can
 * scan every heading without operating a tab, and search/answer engines receive
 * the same substantive copy a person sees.
 */
export function FeaturesListicle() {
  return (
    <Section id="features" size="dense">
      <SectionHeader
        eyebrow="What's included"
        title="Everything set up before you go live"
        description="Six parts of the launch, each tied to a practical objection it removes."
      />
      <ol className="mt-5 divide-y-2 divide-dashed divide-border border-y-2 border-ink sm:mt-6">
        {FEATURES.map((feature, index) => (
          <li
            key={feature.key}
            id={`feature-${feature.key}`}
            className="grid gap-4 py-5 sm:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.2fr)] sm:gap-8 sm:py-7"
          >
            <div className="grid content-start gap-3">
              <div className="flex items-center gap-3">
                <IconRoundel
                  size="md"
                  tone={index === 0 ? "primary" : "secondary"}
                  icon={FEATURE_GLYPH[feature.key]}
                />
                <span className="mono-meta text-muted-foreground">
                  {String(index + 1).padStart(2, "0")} · {feature.tab}
                </span>
              </div>
              <h3 className="text-xl leading-snug font-extrabold text-foreground">
                {feature.title}
              </h3>
              <p className="mono-id text-primary uppercase">
                {feature.removes}
              </p>
            </div>
            <ul className="grid content-start gap-2.5">
              {feature.includes.map((item) => (
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
          </li>
        ))}
      </ol>
    </Section>
  )
}
