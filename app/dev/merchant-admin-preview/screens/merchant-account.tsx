import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import { MerchantProfileForm } from "@/components/merchant/profile-form"
import { MERCHANT_PREVIEW_MOCK } from "./mock-data"

/**
 * Mirror of `/app/account` on the Profile tab (the default). Reuses the real
 * `MerchantProfileForm` client component. The
 * read-only "what customers see" card is mirrored from `ProfilePanel`, whose
 * server body self-loads the merchant from Supabase. Billing lives on its own
 * tab/receipt and is not duplicated here.
 */
export function MerchantAccountScreen() {
  return (
    <div className="grid gap-6">
      <PageTitle
        title="Profile"
        description="Your business and venue details. Changes save as you go."
      />

      <section className="grid gap-5">
        <section className="surface-card grid gap-3 p-5">
          <p className="eyebrow">What customers see</p>
          <p className="text-2xl leading-tight font-extrabold">
            {MERCHANT_PREVIEW_MOCK.locationName}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            1 High Street, London E1 6AN
          </p>
          <Link
            href="/app/launch?tab=venue"
            className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-ink underline decoration-2 underline-offset-4 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:text-primary motion-reduce:transition-none"
          >
            Edit venue details
            <Icon icon={ArrowRight01Icon} size={15} />
          </Link>
        </section>

        <div className="grid gap-3">
          <MerchantProfileForm
            businessName={MERCHANT_PREVIEW_MOCK.businessName}
            businessType={MERCHANT_PREVIEW_MOCK.businessType}
            email={MERCHANT_PREVIEW_MOCK.email}
            phone={MERCHANT_PREVIEW_MOCK.phone}
          />
          <p className="text-sm leading-6 text-muted-foreground">
            Your business name and contact details stay on your account for
            billing and support. Your venue name and address — what customers
            see when they join — are managed in Launch.
          </p>
        </div>
      </section>
    </div>
  )
}
