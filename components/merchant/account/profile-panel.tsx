import { redirect } from "next/navigation"

import { SectionHeader } from "@/components/brand"
import { MerchantProfileForm } from "@/components/merchant/profile-form"
import { getMerchantProfile } from "@/lib/merchant/profile"
import {
  formatVenueAddressDisplay,
  venueAddressFieldsFromLocation,
} from "@/lib/merchant/venue-address"

/**
 * Profile tab of the Account hub. Self-loads the signed-in merchant and its
 * primary venue, shows a read-only "what customers see" preview strip, then the
 * grouped business/venue edit form.
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
    <section className="grid gap-4">
      <SectionHeader
        title="Business details"
        description="These details appear on your loyalty materials and to our support team."
      />

      <section className="surface-card grid gap-1 p-4 shadow-xs">
        <p className="eyebrow">What customers see</p>
        <p className="text-lg font-extrabold">
          {profile.location?.name || profile.merchant.business_name}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {venueAddressDisplay ||
            "Add your venue address below so customers can find you."}
        </p>
      </section>

      <div className="grid max-w-2xl gap-3">
        <MerchantProfileForm
          businessName={profile.merchant.business_name}
          businessType={profile.merchant.business_type}
          email={profile.merchant.email}
          phone={profile.merchant.phone ?? ""}
          venueName={profile.location?.name ?? ""}
          {...addressFields}
        />
        <p className="text-sm leading-6 text-muted-foreground">
          Customers see your venue display name and address when they join and
          collect stamps. Your business name and contact details stay on your
          account for billing and support.
        </p>
      </div>
    </section>
  )
}
