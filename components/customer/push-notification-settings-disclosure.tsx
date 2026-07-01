"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

import { SectionHeader } from "@/components/brand"
import type { PushNotificationSettingsProps } from "@/components/customer/push-notification-settings"

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
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <SectionHeader eyebrow="Push" title="Browser notifications" />
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink font-mono text-sm font-black"
        >
          {open ? "-" : "+"}
        </span>
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
