import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import { AccountTabBar } from "@/components/merchant/account/account-tab-bar"
import { resolveAccountTab } from "@/components/merchant/account/account-tabs"
import { AccountBillingPanelSkeleton } from "@/components/merchant/loading-skeletons"
import { MerchantProfileForm } from "@/components/merchant/profile-form"

import { HARNESS_MERCHANT } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TAB_HEADING = {
  profile: {
    title: "Profile",
    description: "Your business and venue details. Save when you're done.",
  },
  billing: {
    title: "Billing",
    description: "Your plan and payments, handled securely by Stripe.",
  },
} as const

type AccountHarnessPageProps = {
  searchParams?: Promise<{ tab?: string }>
}

/**
 * Account harness — mounts the REAL {@link AccountTabBar} (the segmented sub-nav
 * the /app/account page renders) and, for the Profile tab, the REAL
 * {@link MerchantProfileForm} client body fed DB-free props plus a reconstructed
 * "What customers see" snapshot mirroring ProfilePanel's read-only card.
 *
 * The Billing tab's {@link import("@/components/merchant/account/billing-panel").BillingPanel}
 * is an async server component that self-fetches the signed-in merchant + Stripe
 * billing row and exposes NO presentational prop seam (its cards are private),
 * so the harness renders the REAL {@link AccountBillingPanelSkeleton} as the
 * closest DB-free billing surface. See the qa-harness summary `gaps` entry.
 */
export default async function AccountHarnessPage({
  searchParams,
}: AccountHarnessPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const tab = resolveAccountTab(params.tab)
  const heading = TAB_HEADING[tab]

  return (
    <div className="grid gap-6">
      <PageTitle title={heading.title} description={heading.description} />
      <AccountTabBar activeTab={tab} />

      {tab === "billing" ? (
        <AccountBillingPanelSkeleton />
      ) : (
        <section className="grid min-w-0 gap-5">
          <section className="surface-card grid min-w-0 gap-3 p-5">
            <p className="eyebrow">What customers see</p>
            <p className="text-2xl leading-tight font-extrabold break-words">
              {HARNESS_MERCHANT.business_name}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              12 High Street, Girton, Cambridge, CB3 0QH
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
              businessName={HARNESS_MERCHANT.business_name}
              businessType="pub"
              email="owner@oldcrowngirton.co.uk"
              phone="07700900421"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Address and GPS checks are managed in Setup. Your business name is
              saved here because it is reused on customer cards, reward screens,
              venue QR flows, billing, and support.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
