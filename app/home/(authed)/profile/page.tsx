import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { CustomerProfileAboutYou } from "@/components/customer/profile-about-you"
import { CustomerProfileMarketing } from "@/components/customer/profile-marketing-consent"
import { PushNotificationSettingsDisclosure } from "@/components/customer/push-notification-settings-disclosure"
import { StatusBanner } from "@/components/loyalty"
import { getCustomerProfile } from "@/lib/customer/profile"
import { formatMonthYear } from "@/lib/customer/format"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

export const metadata = {
  title: "Your details · Nabaperks",
}

export default async function HomeProfilePage() {
  const profile = await getCustomerProfile()

  if (!profile) {
    redirect(customerLoginHref("/home/profile"))
  }

  const incomplete = !profile.fullName || !profile.dateOfBirth
  const venueLabel = `${profile.membershipCount} ${
    profile.membershipCount === 1 ? "venue" : "venues"
  }`

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your details"
        description="How venues can reach you: phone, name, and optional email."
      />

      {incomplete ? (
        <StatusBanner title="Finish your details" tone="warning">
          Add your name and date of birth so rewards are ready for collection.
        </StatusBanner>
      ) : null}

      <CustomerProfileAboutYou
        profile={{
          phone: profile.phone,
          fullName: profile.fullName,
          dateOfBirth: profile.dateOfBirth,
          email: profile.email,
          emailVerified: profile.emailVerified,
          emailLocked: profile.emailLocked,
          needsEmailVerification: profile.needsEmailVerification,
        }}
      />

      <CustomerProfileMarketing consents={profile.consents} />

      <PushNotificationSettingsDisclosure />

      <p className="mono-id tracking-[0.08em] text-muted-foreground">
        Member since {formatMonthYear(profile.memberSince)} · {venueLabel}
      </p>
    </div>
  )
}
