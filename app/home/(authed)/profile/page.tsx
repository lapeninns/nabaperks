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
import { emailPromptOpening } from "@/lib/customer/email-prompt-opening"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { getCustomerProfile } from "@/lib/customer/profile"
import { getPendingEmailVerification } from "@/lib/customer/session"
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

  const incomplete =
    !profile.fullName ||
    !profile.dateOfBirth ||
    !profile.emailVerified ||
    !profile.phoneVerified
  // An email-only wallet: no phone, so no phone messages or phone marketing
  // until one is added from the contact details section.
  const hasPhone = profile.phoneVerified
  const emailSignInOn = emailSignInEnabled()
  // The code step opens only while a code for the saved address is pending
  // for this customer, the rule the home prompt uses (QA BUG-036).
  const emailCodeSentAt = profile.needsEmailVerification
    ? await pendingEmailCodeSentAt()
    : null
  const venueLabel = `${profile.membershipCount} ${
    profile.membershipCount === 1 ? "venue" : "venues"
  }`

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your details"
        description="Your contact details and the information needed to collect rewards."
      />

      {incomplete ? (
        <StatusBanner title="Finish your details" tone="warning">
          Complete your name and date of birth, and verify your email and phone
          number before collecting a reward. You can keep earning stamps
          meanwhile.
        </StatusBanner>
      ) : null}

      <CustomerProfileAboutYou
        profile={{
          phone: profile.phoneVerified ? profile.phone : null,
          fullName: profile.fullName,
          dateOfBirth: profile.dateOfBirth,
          email: profile.email,
          emailVerified: profile.emailVerified,
          emailLocked: profile.emailLocked,
          needsEmailVerification: profile.needsEmailVerification,
        }}
        emailCodeSentAt={emailCodeSentAt}
        emailReason={emailPromptReason()}
        addPhone={<CustomerProfileAddPhone hasPhone={hasPhone} />}
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
          emailSignInEnabled: emailSignInOn,
        })}
        emailSignInPaused={!hasPhone && !emailSignInOn}
        signOutAction={signOutCustomerAction}
        signOutAllAction={signOutAllCustomerDevicesAction}
      />
    </div>
  )
}

/** When the pending code for the saved address was sent; null if none is. */
async function pendingEmailCodeSentAt(): Promise<number | null> {
  const [customer, pending] = await Promise.all([
    getCurrentCustomer(),
    getPendingEmailVerification(),
  ])
  return customer &&
    pending &&
    emailPromptOpening(customer, pending).codePending
    ? pending.issuedAt
    : null
}
