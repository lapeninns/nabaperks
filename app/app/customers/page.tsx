import { redirect } from "next/navigation"
import { Suspense } from "react"
import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { MerchantCustomersTableSkeleton } from "@/components/merchant/loading-skeletons"
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

  const highlightedMembershipId = firstParam(params.highlight)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Customers"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
      />

      <Suspense fallback={<MerchantCustomersTableSkeleton />}>
        <CustomersTableStream
          merchantId={merchant.id}
          highlightedMembershipId={highlightedMembershipId}
        />
      </Suspense>
    </div>
  )
}

async function CustomersTableStream({
  merchantId,
  highlightedMembershipId,
}: {
  merchantId: string
  highlightedMembershipId?: string
}) {
  const rawCustomers = await getMerchantCustomers(merchantId)
  const now = new Date()

  // Build masked-safe view models server-side so no raw PII reaches the client
  // bundle. The client table component receives only pre-masked identifiers.
  const customers = rawCustomers.map((row) =>
    buildMerchantCustomerReadback(row, now)
  )

  // The client table owns its own summary / search / filter UI; the server only
  // hands it pre-masked view models so no raw PII reaches the client bundle.
  return (
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
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
