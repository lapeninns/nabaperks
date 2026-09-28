import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { CustomerProfileAboutYou } from "@/components/customer/profile-about-you"
import { CustomerProfileAccountSection } from "@/components/customer/profile-account-section"
import { CustomerProfileAddPhone } from "@/components/customer/profile-add-phone"
import { CustomerProfileMarketing } from "@/components/customer/profile-marketing-consent"
import { PhoneMessagingSettings } from "@/components/customer/phone-messaging-settings"
import { StatusBanner } from "@/components/loyalty"
import { customerSignInMethodsLabel } from "@/lib/customer/sign-in-methods"
import { harnessProfilePhoneAction } from "./actions"

/**
 * Fixture sign-out. The real screen submits `signOutCustomerAction` and
 * `signOutAllCustomerDevicesAction`; the harness has no session to clear, so it
 * proves placement and the tap contract only.
 */
async function noopSignOutAction() {
  "use server"
}

/**
 * `?wallet=email-only` is a wallet started with an email: no phone, so no
 * phone messages or phone marketing, and the account area offers to add one.
 */
export default async function CustomerProfileHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }
  if ((await searchParams).wallet === "email-only") {
    return <EmailOnlyProfile />
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your details"
        description="Your contact details and the information needed to collect rewards."
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
        signOutAllAction={noopSignOutAction}
      />
    </div>
  )
}

function EmailOnlyProfile() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your details"
        description="Your contact details and the information needed to collect rewards."
      />
      <StatusBanner title="Finish your details" tone="warning">
        Complete your name and date of birth, and verify your email and phone
        number before collecting a reward. You can keep earning stamps
        meanwhile.
      </StatusBanner>
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
      <CustomerProfileMarketing
        consents={[{ channel: "email", optedIn: true }]}
        hasPhone={false}
      />
      <CustomerProfileAccountSection
        memberSinceLabel="September 2026"
        venueLabel="1 venue"
        signInWith={customerSignInMethodsLabel({
          hasPhone: false,
          hasVerifiedEmail: true,
          emailSignInEnabled: true,
        })}
        signOutAction={noopSignOutAction}
        signOutAllAction={noopSignOutAction}
      />
    </div>
  )
}
