import { redirect } from "next/navigation"

import {
  signOutAllCustomerDevicesAction,
  signOutCustomerAction,
} from "@/app/home/actions"
import { PageTitle } from "@/components/brand"
import { CustomerProfileAboutYou } from "@/components/customer/profile-about-you"
import { CustomerProfileAccountSection } from "@/components/customer/profile-account-section"
import { CustomerProfileAddPhone } from "@/components/customer/profile-add-phone"
import { ProfileContactNotice } from "@/components/customer/profile-contact-notice"
import { CustomerProfileMessagesSection } from "@/components/customer/profile-messages-section"
import { CustomerProfilePreviousStamps } from "@/components/customer/profile-previous-stamps"
import { StatusBanner } from "@/components/loyalty"
import { emailPromptReason } from "@/lib/customer/email-auth-mode"
import { emailPromptOpening } from "@/lib/customer/email-prompt-opening"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  CONTACT_NOTICE_PARAM,
  previousStampsMethod,
} from "@/lib/customer/previous-stamps"
import { getCustomerProfile } from "@/lib/customer/profile"
import { getPendingEmailVerification } from "@/lib/customer/session"
import { formatMonthYear } from "@/lib/customer/format"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

export const metadata = {
  title: "Your details · Nabaperks",
}

/** Why the details matter, only while something a reward needs is missing. */
const FINISH_DETAILS_COPY =
  "Collecting a reward needs your name, date of birth, and a confirmed mobile number and email. You can keep collecting stamps meanwhile."

type HomeProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The guest's profile, in the order of the brief: your details and contact
 * (one card), messages from venues (optional), previous stamps (optional),
 * then sign out. Phone is the only way in, so the page never names email as
 * a sign-in route or describes the email rollout setting.
 */
export default async function HomeProfilePage({
  searchParams,
}: HomeProfilePageProps) {
  const profile = await getCustomerProfile()

  if (!profile) {
    redirect(customerLoginHref("/home/profile"))
  }

  const params = await searchParams
  const incomplete =
    !profile.fullName ||
    !profile.dateOfBirth ||
    !profile.emailVerified ||
    !profile.phoneVerified
  // A card started with an email: no phone, so no phone reminders or phone
  // offers until one is added from the Contact group.
  const hasPhone = profile.phoneVerified
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
        description="What a venue needs to hand over a reward, and the messages you get."
      />

      {incomplete ? (
        <StatusBanner title="Finish your details" tone="warning">
          {FINISH_DETAILS_COPY}
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

      <CustomerProfileMessagesSection
        consents={profile.consents}
        hasPhone={hasPhone}
        phoneMessagingPreferences={profile.phoneMessagingPreferences}
      />

      <CustomerProfilePreviousStamps
        method={previousStampsMethod({
          phoneVerified: profile.phoneVerified,
          emailVerified: profile.emailVerified,
        })}
        notice={
          <ProfileContactNotice
            value={params[CONTACT_NOTICE_PARAM]}
            confirmed={{
              phone: profile.phoneVerified,
              email: profile.emailVerified,
            }}
          />
        }
      />

      <CustomerProfileAccountSection
        memberSinceLabel={formatMonthYear(profile.memberSince)}
        venueLabel={venueLabel}
        signInWith={hasPhone ? "your mobile number" : undefined}
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
