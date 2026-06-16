import Link from "next/link"
import { redirect } from "next/navigation"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { MerchantProfileForm } from "@/components/merchant/profile-form"
import { getMerchantProfile } from "@/lib/merchant/profile"
import {
  formatVenueAddressDisplay,
  venueAddressFieldsFromLocation,
} from "@/lib/merchant/venue-address"

/**
 * Profile tab of the Account hub. Leads with the read-only "what customers see"
 * card (the venue, which is edited in Launch), then the business/account edit
 * form. Venue editing is intentionally a link to Launch, not a second form.
 */
export async function ProfilePanel() {
  const profile = await getMerchantProfile()

  if (!profile) {
    redirect("/app/onboarding")
  }

  const addressFields = venueAddressFieldsFromLocation({
    address: profile.location?.address ?? null,
    address_line_1: profile.location?.address_line_1,
    address_line_2: profile.location?.address_line_2,
    address_city: profile.location?.address_city,
    address_postcode: profile.location?.address_postcode,
  })

  const venueAddressDisplay = formatVenueAddressDisplay({
    line1: addressFields.addressLine1,
    line2: addressFields.addressLine2 || null,
    city: addressFields.addressCity,
    postcode: addressFields.addressPostcode,
    country: "GB",
  })

  return (
    <section className="grid gap-5">
      <section className="surface-card grid gap-3 p-5">
        <p className="eyebrow">What customers see</p>
        <p className="text-2xl leading-tight font-extrabold">
          {profile.location?.name || profile.merchant.business_name}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {venueAddressDisplay ||
            "Add your venue address in Launch so customers can find you."}
        </p>
        <Link
          href="/app/launch?tab=venue"
          className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-ink underline decoration-2 underline-offset-4 transition-colors hover:text-primary"
        >
          Edit venue details
          <Icon icon={ArrowRight01Icon} size={15} />
        </Link>
      </section>

      <div className="grid gap-3">
        <MerchantProfileForm
          businessName={profile.merchant.business_name}
          businessType={profile.merchant.business_type}
          email={profile.merchant.email}
          phone={profile.merchant.phone ?? ""}
        />
        <p className="text-sm leading-6 text-muted-foreground">
          Your business name and contact details stay on your account for
          billing and support. Your venue name and address — what customers see
          when they join — are managed in Launch.
        </p>
      </div>
    </section>
  )
}
