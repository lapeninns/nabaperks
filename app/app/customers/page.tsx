import { redirect } from "next/navigation"

import { EmptyState, MonoTag, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { getCurrentMerchant } from "@/lib/auth/session"
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
  const customers = await getMerchantCustomers(merchant.id)
  const highlightedMembershipId = firstParam(params.highlight)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Customers"
        title="Loyalty members"
        description="Stamp progress and rewards for everyone who has joined your card."
        actions={
          customers.length > 0 ? (
            <MonoTag tone="ink">
              {customers.length} {customers.length === 1 ? "member" : "members"}
            </MonoTag>
          ) : undefined
        }
      />

      <CustomerReadbackTable
        customers={customers}
        highlightedMembershipId={highlightedMembershipId}
        emptyState={
          <EmptyState
            title="No customers yet"
            description="Customers will appear here after they join from the venue QR."
          />
        }
      />
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
