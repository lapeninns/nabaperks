import { redirect } from "next/navigation"

import {
  signOutAllCustomerDevicesAction,
  signOutCustomerAction,
} from "@/app/home/actions"
import { PageTitle } from "@/components/brand"
import { CustomerProfileAboutYou } from "@/components/customer/profile-about-you"
import { CustomerProfileAccountSection } from "@/components/customer/profile-account-section"
import { CustomerProfileAddPhone } from "@/components/customer/profile-add-phone"
import { CustomerProfileMarketing } from "@/components/customer/profile-marketing-consent"
import { PhoneMessagingSettings } from "@/components/customer/phone-messaging-settings"
import { PushNotificationSettingsDisclosure } from "@/components/customer/push-notification-settings-disclosure"
import { StatusBanner } from "@/components/loyalty"
import {
  emailPromptReason,
  emailSignInEnabled,
} from "@/lib/customer/email-auth-mode"
import { getCustomerProfile } from "@/lib/customer/profile"
import { formatMonthYear } from "@/lib/customer/format"
import { customerSignInMethodsLabel } from "@/lib/customer/sign-in-methods"
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
  // An email-only wallet: no phone, so no phone messages or phone marketing
  // until one is added from the account section.
  const hasPhone = Boolean(profile.phone)
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
        emailReason={emailPromptReason()}
      />

      <CustomerProfileMarketing
        consents={profile.consents}
        hasPhone={hasPhone}
      />

      {hasPhone ? (
        <PhoneMessagingSettings
          preferences={profile.phoneMessagingPreferences}
        />
      ) : null}

      <PushNotificationSettingsDisclosure />

      <CustomerProfileAccountSection
        memberSinceLabel={formatMonthYear(profile.memberSince)}
        venueLabel={venueLabel}
        signInWith={customerSignInMethodsLabel({
          hasPhone,
          hasVerifiedEmail: profile.emailVerified,
          emailSignInEnabled: emailSignInEnabled(),
        })}
        addPhone={hasPhone ? undefined : <CustomerProfileAddPhone />}
        signOutAction={signOutCustomerAction}
        signOutAllAction={signOutAllCustomerDevicesAction}
      />
    </div>
  )
}
