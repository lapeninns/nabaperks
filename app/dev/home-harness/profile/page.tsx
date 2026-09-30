import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { PageTitle } from "@/components/brand"
import { CustomerProfileAboutYou } from "@/components/customer/profile-about-you"
import { CustomerProfileAccountSection } from "@/components/customer/profile-account-section"
import { CustomerProfileAddPhone } from "@/components/customer/profile-add-phone"
import { ProfileContactNotice } from "@/components/customer/profile-contact-notice"
import { CustomerProfileMessagesSection } from "@/components/customer/profile-messages-section"
import { CustomerProfilePreviousStamps } from "@/components/customer/profile-previous-stamps"
import { CustomerProfilePreviousStampsEmail } from "@/components/customer/profile-previous-stamps-email"
import { StatusBanner } from "@/components/loyalty"
import {
  PREVIOUS_STAMPS_RETURN_TO,
  previousStampsMethod,
} from "@/lib/customer/previous-stamps"
import {
  harnessPreviousStampsEmailAction,
  harnessProfilePhoneAction,
} from "./actions"

/**
 * Fixture sign-out. The real screen submits `signOutCustomerAction` and
 * `signOutAllCustomerDevicesAction`; the harness has no session to clear, so it
 * proves placement and the tap contract only.
 */
async function noopSignOutAction() {
  "use server"
  if (process.env.NODE_ENV === "production") notFound()
}

const TITLE = (
  <PageTitle
    eyebrow="My Nabaperks"
    title="Your details"
    description="What a venue needs to hand over a reward, and the messages you get."
  />
)

const FINISH_DETAILS = (
  <StatusBanner title="Finish your details" tone="warning">
    Collecting a reward needs your name, date of birth, and a confirmed mobile
    number and email. You can keep collecting stamps meanwhile.
  </StatusBanner>
)

const PHONE_PREFERENCES = {
  phoneMessagesEnabled: true,
  preferredPhoneChannel: "whatsapp",
  whatsappUnavailableAt: "2026-09-19T09:00:00.000Z",
} as const

/**
 * Lanes, all from literal fixtures:
 * - default: a card with a confirmed mobile number and an email awaiting its
 *   code; previous stamps asks for the other email (`linked@`, `again@`,
 *   `review@`, `held@` pick the outcome after code 424242).
 * - `?email=no-code`: the saved, unconfirmed email with no code pending (a
 *   failed send, a lapsed code, another browser): the card offers to send
 *   one (QA BUG-036).
 * - `?wallet=email-only`: a card started with an email. Contact asks for a
 *   mobile number; previous stamps asks for the other number (07700900997
 *   brings stamps together, 996 sign in again, 995 staff, 999 used by
 *   another card, 998 save failed, 994 code expired).
 * - `?wallet=complete`: both contacts confirmed; previous stamps points to
 *   staff.
 * - `?contact=`: a notice a task redirected back with (`stamps-together`,
 *   `nothing-found-phone`, `nothing-found-email`, `phone-added`). It shows
 *   only when the lane's confirmed contacts back it (the default lane has a
 *   phone, `email-only` an email, `complete` both), as on /home/profile.
 */
export default async function CustomerProfileHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string; email?: string; contact?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }
  const query = await searchParams
  // Each lane's confirmed contacts back the notice, as on /home/profile.
  const notice = (confirmed: { phone: boolean; email: boolean }) => (
    <ProfileContactNotice value={query.contact} confirmed={confirmed} />
  )
  if (query.wallet === "email-only") {
    return <EmailOnlyProfile notice={notice({ phone: false, email: true })} />
  }
  if (query.wallet === "complete") {
    return <CompleteProfile notice={notice({ phone: true, email: true })} />
  }

  return (
    <div className="grid gap-6">
      {TITLE}
      {FINISH_DETAILS}
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
        // A fixed literal time keeps the lane deterministic.
        emailCodeSentAt={query.email === "no-code" ? null : 1_790_000_000}
      />
      <CustomerProfileMessagesSection
        consents={[{ channel: "whatsapp", optedIn: true }]}
        hasPhone
        phoneMessagingPreferences={PHONE_PREFERENCES}
        eligibility={{
          hasVerifiedPhone: true,
          hasVerifiedEmail: false,
          membershipCount: 1,
        }}
      />
      <CustomerProfilePreviousStamps
        method={previousStampsMethod({
          phoneVerified: true,
          emailVerified: false,
        })}
        notice={notice({ phone: true, email: false })}
        form={
          <CustomerProfilePreviousStampsEmail
            action={harnessPreviousStampsEmailAction}
            returnTo={PREVIOUS_STAMPS_RETURN_TO}
          />
        }
      />
      <CustomerProfileAccountSection
        memberSinceLabel="September 2026"
        venueLabel="1 venue"
        signInWith="your mobile number"
        signOutAction={noopSignOutAction}
        signOutAllAction={noopSignOutAction}
      />
    </div>
  )
}

function EmailOnlyProfile({ notice }: { notice: ReactNode }) {
  return (
    <div className="grid gap-6">
      {TITLE}
      {FINISH_DETAILS}
      <CustomerProfileAboutYou
        profile={{
          phone: null,
          fullName: "Alex Regular",
          dateOfBirth: "1990-01-01",
          email: "alex@example.test",
          emailVerified: true,
          emailLocked: true,
          needsEmailVerification: false,
        }}
        addPhone={
          <CustomerProfileAddPhone action={harnessProfilePhoneAction} />
        }
      />
      <CustomerProfileMessagesSection
        consents={[{ channel: "email", optedIn: true }]}
        hasPhone={false}
        phoneMessagingPreferences={null}
        // Literal, so the DB-free lane never loads eligibility from a session.
        eligibility={{
          hasVerifiedPhone: false,
          hasVerifiedEmail: true,
          membershipCount: 1,
        }}
      />
      <CustomerProfilePreviousStamps
        method={previousStampsMethod({
          phoneVerified: false,
          emailVerified: true,
        })}
        notice={notice}
        form={
          <CustomerProfileAddPhone
            action={harnessProfilePhoneAction}
            variant="previous"
          />
        }
      />
      <CustomerProfileAccountSection
        memberSinceLabel="September 2026"
        venueLabel="1 venue"
        signOutAction={noopSignOutAction}
        signOutAllAction={noopSignOutAction}
      />
    </div>
  )
}

function CompleteProfile({ notice }: { notice: ReactNode }) {
  return (
    <div className="grid gap-6">
      {TITLE}
      <CustomerProfileAboutYou
        profile={{
          phone: "+447700900123",
          fullName: "Alex Regular",
          dateOfBirth: "1990-01-01",
          email: "alex@example.test",
          emailVerified: true,
          emailLocked: true,
          needsEmailVerification: false,
        }}
      />
      <CustomerProfileMessagesSection
        consents={[
          { channel: "email", optedIn: true },
          { channel: "sms", optedIn: false },
        ]}
        hasPhone
        phoneMessagingPreferences={{
          ...PHONE_PREFERENCES,
          phoneMessagesEnabled: false,
        }}
        eligibility={{
          hasVerifiedPhone: true,
          hasVerifiedEmail: true,
          membershipCount: 2,
        }}
      />
      <CustomerProfilePreviousStamps
        method={previousStampsMethod({
          phoneVerified: true,
          emailVerified: true,
        })}
        notice={notice}
      />
      <CustomerProfileAccountSection
        memberSinceLabel="September 2026"
        venueLabel="2 venues"
        signInWith="your mobile number"
        signOutAction={noopSignOutAction}
        signOutAllAction={noopSignOutAction}
      />
    </div>
  )
}
