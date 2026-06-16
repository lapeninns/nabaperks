import { redirect } from "next/navigation"
import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, MonoTag, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { getCurrentMerchant } from "@/lib/auth/session"
import { buildMerchantCustomerReadback } from "@/lib/merchant/customer-readback"
import { getMerchantCustomers } from "@/lib/merchant/dashboard"

type CustomersPageProps = {
  searchParams?: Promise<{
    highlight?: string | string[]
  }>
}

type CustomersSearchParams = Awaited<
  NonNullable<CustomersPageProps["searchParams"]>
>

export default async function MerchantCustomersPage({
  searchParams,
}: CustomersPageProps) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const params = searchParams
    ? await searchParams
    : ({} satisfies CustomersSearchParams)

  const rawCustomers = await getMerchantCustomers(merchant.id)
  const now = new Date()

  // Build masked-safe view models server-side so no raw PII reaches the client
  // bundle. The client table component receives only pre-masked identifiers.
  const customers = rawCustomers.map((row) =>
    buildMerchantCustomerReadback(row, now)
  )

  const highlightedMembershipId = firstParam(params.highlight)

  // Derived counts for at-a-glance stats — computed from masked data, no PII.
  const readyCount = customers.filter((c) => c.badge.tone === "ready").length
  const quietCount = customers.filter((c) => c.badge.tone === "quiet").length

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Customers"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
        actions={
          customers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <MonoTag tone="ink">
                {customers.length}{" "}
                {customers.length === 1 ? "member" : "members"}
                {readyCount > 0 ? ` · ${readyCount} ready to redeem` : ""}
                {quietCount > 0 ? ` · ${quietCount} gone quiet` : ""}
              </MonoTag>
              <MonoTag tone="plain">Initials only · Phones stay hashed</MonoTag>
            </div>
          ) : undefined
        }
      />

      <CustomerReadbackTable
        customers={customers}
        highlightedMembershipId={highlightedMembershipId}
        emptyState={
          <EmptyState
            title="No customers yet"
            description="Customers will appear here after they join via the venue QR."
            icon={UserMultiple02Icon}
          />
        }
      />
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
