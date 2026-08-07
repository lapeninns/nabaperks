"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { Icon, SectionHeader } from "@/components/brand"
import type { PushNotificationSettingsProps } from "@/components/customer/push-notification-settings"
import { Skeleton } from "@/components/ui/skeleton"

const DeferredPushNotificationSettings = dynamic<PushNotificationSettingsProps>(
  () =>
    import("@/components/customer/push-notification-settings").then(
      (module) => module.PushNotificationSettings
    ),
  { loading: PushSettingsFallback }
)

export function PushNotificationSettingsDisclosure() {
  const [open, setOpen] = useState(false)

  return (
    <details
      className="surface-card p-5"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {/* `.focus-ring` so keyboard users get a visible ring on a primary
          disclosure (CardDetailsDisclosure, the journey's other <details>,
          already has one), and the same ArrowDown01Icon chevron it uses instead
          of an IconRoundel printing a literal "-" / "+" — a hyphen rendered as
          a minus is optically off-centre, and DESIGN.md reserves the Icon
          wrapper for every functional glyph (CUS 02#49). */}
      <summary className="group focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg [&::-webkit-details-marker]:hidden">
        <SectionHeader eyebrow="Push" title="Browser notifications" />
        <Icon
          icon={ArrowDown01Icon}
          size={18}
          className="shrink-0 text-ink-soft transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {open ? (
        <div className="pt-4">
          <DeferredPushNotificationSettings
            showHeader={false}
            surface={false}
          />
        </div>
      ) : null}
    </details>
  )
}

/**
 * The real content is an h-[76px] status box, a `size="sm"` button and three
 * two-line preference rows (~55px each). The fallback measured 16 / 9 / 10 and
 * used bare `bg-muted` divs — a different grey from every other loading state
 * in the app, which all render the themed `[data-slot="skeleton"]` fill — so
 * the disclosure visibly jumped ~50px when the chunk landed (CUS 02#48).
 */
function PushSettingsFallback() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <Skeleton className="h-[76px] rounded-lg" />
      <Skeleton className="h-11 w-32 rounded-lg" />
      <div className="grid gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  )
}
