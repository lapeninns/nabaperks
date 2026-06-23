import { PageTitle } from "@/components/brand"
import { PushNotificationSettings } from "@/components/customer/push-notification-settings"

export default function CustomerNotificationsDevPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[410px] content-start gap-6 px-4 py-6">
      <PageTitle
        eyebrow="Dev"
        title="Push settings"
        description="Mocked browser states for the customer notification card."
      />
      <PushNotificationSettings />
    </main>
  )
}
