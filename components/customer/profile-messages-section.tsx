import { SectionHeader } from "@/components/brand"
import { CustomerProfileMarketing } from "@/components/customer/profile-marketing-consent"
import { PhoneMessagingSettings } from "@/components/customer/phone-messaging-settings"
import { PushNotificationSettingsDisclosure } from "@/components/customer/push-notification-settings-disclosure"
import type { MarketingConsentEligibility } from "@/lib/customer/consent"
import type { PhoneMessagingPreferences } from "@/lib/customer/profile"

type MarketingConsent = {
  channel: "email" | "sms" | "whatsapp" | "push"
  optedIn: boolean
}

/**
 * "Messages from venues": one optional block on the profile instead of three
 * overlapping cards. Offers per channel (marketing consent, recorded
 * server-side per venue), reminders by phone for a card with a confirmed
 * mobile number, and notifications on this device. Each part keeps its own
 * server action; only the presentation is shared.
 */
export function CustomerProfileMessagesSection({
  consents,
  hasPhone,
  phoneMessagingPreferences,
  eligibility,
}: {
  consents: readonly MarketingConsent[]
  hasPhone: boolean
  phoneMessagingPreferences: PhoneMessagingPreferences | null
  /** Loaded for the signed-in card when not given (the harness passes it). */
  eligibility?: MarketingConsentEligibility | null
}) {
  return (
    <section
      className="surface-card grid gap-5 p-5"
      aria-labelledby="messages-from-venues"
      data-messages-section
    >
      <SectionHeader
        eyebrow="Optional"
        title={<span id="messages-from-venues">Messages from venues</span>}
      />
      <CustomerProfileMarketing
        consents={consents}
        hasPhone={hasPhone}
        eligibility={eligibility}
        embedded
      />
      {hasPhone ? (
        <div className="border-t-2 border-dashed border-border pt-4">
          <PhoneMessagingSettings
            preferences={phoneMessagingPreferences}
            embedded
          />
        </div>
      ) : null}
      <PushNotificationSettingsDisclosure embedded />
    </section>
  )
}
