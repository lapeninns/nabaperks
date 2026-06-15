import { signOutCustomerAction } from "@/app/home/actions"
import { Eyebrow, EmptyState, MetricTile, MonoTag, PageTitle } from "@/components/brand"
import { CustomerProfileEditForm } from "@/components/customer/profile-edit-form"
import { Button } from "@/components/ui/button"
import { getCustomerProfile, type CustomerConsent } from "@/lib/customer/profile"
import { formatMonthYear } from "@/lib/customer/format"

export const metadata = {
  title: "Your profile — Nabaperks",
}

const channelLabels: Record<CustomerConsent["channel"], string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
}

export default async function HomeProfilePage() {
  const profile = await getCustomerProfile()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Profile"
        description="Your account details and how venues can reach you."
      />

      {!profile ? (
        <EmptyState
          title="No profile yet"
          description="Scan a venue's QR code to join your first loyalty card and set up your account."
        />
      ) : (
        <div className="grid gap-6">
          <CustomerProfileEditForm
            profile={{
              fullName: profile.fullName,
              dateOfBirth: profile.dateOfBirth,
              email: profile.email,
              emailVerified: profile.emailVerified,
              needsEmailVerification: profile.needsEmailVerification,
            }}
          />

          <section className="surface-card grid gap-4 p-5">
            <Eyebrow>Phone</Eyebrow>
            <dl className="grid gap-3">
              <Detail label="Verified number" value={profile.phone ?? "—"} />
            </dl>
            <p className="text-xs leading-5 text-muted-foreground">
              Your phone is your sign-in. To change it, join again with the new
              number from a venue QR.
            </p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <MetricTile label="Venues joined" value={profile.membershipCount} />
            <MetricTile label="Member since" value={formatMonthYear(profile.memberSince)} />
          </div>

          <section className="surface-card grid gap-3 p-5">
            <Eyebrow>Marketing updates</Eyebrow>
            {profile.consents.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                You haven&apos;t set any marketing preferences yet. You can update
                them when you join a venue.
              </p>
            ) : (
              <ul className="grid gap-2">
                {profile.consents.map((consent) => (
                  <li
                    key={consent.channel}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-bold">
                      {channelLabels[consent.channel]}
                    </span>
                    <MonoTag tone={consent.optedIn ? "leaf" : "plain"}>
                      {consent.optedIn ? "Opted in" : "Opted out"}
                    </MonoTag>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form action={signOutCustomerAction}>
            <Button type="submit" variant="secondary" className="w-full">
              Log out
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-bold break-all">{value}</dd>
    </div>
  )
}
