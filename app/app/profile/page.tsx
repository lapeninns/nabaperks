import { redirect } from "next/navigation"

import { PageTitle, SectionHeader } from "@/components/brand"
import { MerchantProfileForm } from "@/components/merchant/profile-form"
import { getMerchantProfile } from "@/lib/merchant/profile"
import { venueAddressFieldsFromLocation } from "@/lib/merchant/venue-address"

export default async function MerchantProfilePage() {
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

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Profile"
        title="Your business profile"
        description="Keep your business and venue details up to date. Changes save straight away."
      />

      <section className="grid gap-4">
        <SectionHeader
          title="Business details"
          description="These details appear on your loyalty materials and to our support team."
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_1fr]">
          <MerchantProfileForm
            businessName={profile.merchant.business_name}
            businessType={profile.merchant.business_type}
            email={profile.merchant.email}
            phone={profile.merchant.phone ?? ""}
            venueName={profile.location?.name ?? ""}
            {...addressFields}
          />
          <section className="surface-card p-5 shadow-xs">
            <h3 className="text-lg font-extrabold">What customers see</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your venue display name and address help customers recognise you
              when they join and collect stamps. Your business name and contact
              details stay with your account for billing and support.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}
