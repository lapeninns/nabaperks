import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { PushNotificationSettings } from "@/components/customer/push-notification-settings"

export const dynamic = "force-dynamic"

export default function PushNotificationHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto w-full max-w-customer px-4 py-6">
      <PageTitle
        eyebrow="Harness"
        title="Push harness"
        description="DB-free push preference controls."
      />
      <PushNotificationSettings />
    </main>
  )
}
