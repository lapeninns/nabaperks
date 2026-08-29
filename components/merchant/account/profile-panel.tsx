import { redirect } from "next/navigation"

import { ProfilePanelView } from "@/components/merchant/account/profile-panel-view"
import { getMerchantProfile } from "@/lib/merchant/profile"
import {
  formatVenueAddressDisplay,
  venueAddressFieldsFromLocation,
} from "@/lib/merchant/venue-address"

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
    <ProfilePanelView
      businessName={profile.merchant.business_name}
      businessType={profile.merchant.business_type}
      email={profile.merchant.email}
      phone={profile.merchant.phone ?? ""}
      venueAddressDisplay={venueAddressDisplay}
    />
  )
}
