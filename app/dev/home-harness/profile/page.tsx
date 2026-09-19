import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { CustomerProfileAboutYou } from "@/components/customer/profile-about-you"
import { CustomerProfileAccountSection } from "@/components/customer/profile-account-section"
import { PhoneMessagingSettings } from "@/components/customer/phone-messaging-settings"

/**
 * Fixture sign-out. The real screen submits `signOutCustomerAction`; the harness
 * has no session to clear, so it proves placement and the tap contract only.
 */
async function noopSignOutAction() {
  "use server"
}

export default function CustomerProfileHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your details"
        description="How venues can reach you: phone, name, and optional email."
      />
      <CustomerProfileAboutYou
        profile={{
          phone: "+447700900123",
          fullName: "Alex Regular",
          dateOfBirth: "1990-01-01",
          email: "alex@example.test",
          emailVerified: false,
          emailLocked: false,
          needsEmailVerification: true,
        }}
      />
      <PhoneMessagingSettings
        preferences={{
          phoneMessagesEnabled: true,
          preferredPhoneChannel: "whatsapp",
          whatsappUnavailableAt: "2026-09-19T09:00:00.000Z",
        }}
      />
      <CustomerProfileAccountSection
        memberSinceLabel="September 2026"
        venueLabel="1 venue"
        signOutAction={noopSignOutAction}
      />
    </div>
  )
}
