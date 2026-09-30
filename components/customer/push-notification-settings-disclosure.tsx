"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

import { IconRoundel, SectionHeader } from "@/components/brand"
import type { PushNotificationSettingsProps } from "@/components/customer/push-notification-settings"

const DeferredPushNotificationSettings = dynamic<PushNotificationSettingsProps>(
  () =>
    import("@/components/customer/push-notification-settings").then(
      (module) => module.PushNotificationSettings
    ),
  { loading: PushSettingsFallback }
)

/**
 * Notifications on this browser, loaded only when opened. `embedded` sits
 * inside "Messages from venues" without a card of its own.
 */
export function PushNotificationSettingsDisclosure({
  embedded = false,
}: {
  embedded?: boolean
} = {}) {
  const [open, setOpen] = useState(false)

  return (
    <details
      className={
        embedded
          ? "border-t-2 border-dashed border-border pt-4"
          : "surface-card p-5"
      }
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        {embedded ? (
          <h3 className="eyebrow">Notifications on this device</h3>
        ) : (
          <SectionHeader eyebrow="Notifications" title="On this device" />
        )}
        <IconRoundel
          size="sm"
          className="bg-transparent font-mono text-sm font-black"
        >
          {open ? "-" : "+"}
        </IconRoundel>
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

function PushSettingsFallback() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="h-16 rounded-xl border-2 border-ink bg-secondary/60" />
      <div className="h-9 w-32 rounded-lg border-2 border-ink bg-muted" />
      <div className="grid gap-2">
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
      </div>
    </div>
  )
}
