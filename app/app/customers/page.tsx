import { redirect } from "next/navigation"
import { Suspense } from "react"
import { UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { MerchantCustomersTableSkeleton } from "@/components/merchant/loading-skeletons"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantCustomers,
  getMerchantCustomerCount,
} from "@/lib/merchant/dashboard"

export const dynamic = "force-dynamic"

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
    // min-w-0: never let the members table's intrinsic width stretch this
    // grid past the viewport (the intro and filter row clipped at 768 when
    // the table forced page-level horizontal overflow).
    <div className="grid min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
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
  // getMerchantCustomers masks every row inside lib/merchant/* and returns the
  // pre-masked view models directly, so raw email/phone never reach this server
  // component or the client bundle. The client table owns its own summary /
  // search / filter UI over these masked rows.
  // The masked rows are capped at 100; fetch the true member count alongside
  // them (PII-free, head:true) so the "Members" stat reports the real total
  // even when the table list is truncated.
  const [customers, totalMembers] = await Promise.all([
    getMerchantCustomers(merchantId),
    getMerchantCustomerCount(merchantId),
  ])

  return (
    <CustomerReadbackTable
      customers={customers}
      totalMembers={totalMembers}
      highlightedMembershipId={highlightedMembershipId}
      emptyState={
        <EmptyState
          title="No members yet"
          description="Members will appear here after they join via the venue QR."
          icon={UserMultiple02Icon}
        />
      }
    />
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
