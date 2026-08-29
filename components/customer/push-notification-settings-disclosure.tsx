"use client"

import dynamic from "next/dynamic"

import { ProfileSection } from "@/components/customer/profile-section"

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
  return (
    <ProfileSection title="Browser notifications" hint="Off by default">
      <DeferredPushNotificationSettings showHeader={false} surface={false} />
    </ProfileSection>
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
