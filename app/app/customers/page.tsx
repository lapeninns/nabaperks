import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { QrCode01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, Icon, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { MerchantCustomersTableSkeleton } from "@/components/merchant/loading-skeletons"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantCustomers,
  getMerchantCustomerCount,
  getMerchantCustomerPage,
} from "@/lib/merchant/dashboard"
import {
  CUSTOMERS_PAGE_SIZE,
  resolveCustomersPageRequest,
} from "@/lib/merchant/customers-paging"

export const dynamic = "force-dynamic"

type CustomersPageProps = {
  searchParams?: Promise<{
    highlight?: string | string[]
    page?: string | string[]
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
  const requestedPage = firstParam(params.page)
  const pageRequest = resolveCustomersPageRequest(requestedPage)

  if (!requestedPage && highlightedMembershipId) {
    const highlightedPage = await getMerchantCustomerPage(
      merchant.id,
      highlightedMembershipId
    )
    if (highlightedPage && highlightedPage !== pageRequest.page) {
      redirect(
        customersHighlightHref(highlightedMembershipId, highlightedPage)
      )
    }
  }

  return (
    // min-w-0: never let the members table's intrinsic width stretch this
    // grid past the viewport (the intro and filter row clipped at 768 when
    // the table forced page-level horizontal overflow).
    <div className="grid min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
        title="Loyalty members"
        description="Stamp progress and reward status for everyone who has joined your card."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/app/customers/invite">Invite customers</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/customers/send-reward">Send a reward</Link>
            </Button>
          </div>
        }
      />

      <Suspense
        key={pageRequest.page}
        fallback={<MerchantCustomersTableSkeleton />}
      >
        <CustomersTableStream
          merchantId={merchant.id}
          page={pageRequest.page}
          offset={pageRequest.offset}
          highlightedMembershipId={highlightedMembershipId}
        />
      </Suspense>
    </div>
  )
}

async function CustomersTableStream({
  merchantId,
  page,
  offset,
  highlightedMembershipId,
}: {
  merchantId: string
  page: number
  offset: number
  highlightedMembershipId?: string
}) {
  // getMerchantCustomers masks every row inside lib/merchant/* and returns the
  // pre-masked view models directly, so raw email/phone never reach this server
  // component or the client bundle. The client table owns its own summary /
  // search / filter UI over these masked rows.
  // Pages window the newest-first list (CUSTOMERS_PAGE_SIZE rows each); the
  // true member count loads in parallel (PII-free, head:true) so the "Members"
  // stat and the pagination stay honest beyond the first page.
  const [customers, totalMembers] = await Promise.all([
    getMerchantCustomers(merchantId, new Date(), {
      limit: CUSTOMERS_PAGE_SIZE,
      offset,
    }),
    getMerchantCustomerCount(merchantId),
  ])

  return (
    <CustomerReadbackTable
      customers={customers}
      totalMembers={totalMembers}
      page={page}
      highlightedMembershipId={highlightedMembershipId}
      emptyState={
        <EmptyState
          title="No members yet"
          description="Members will appear here after they join via the venue QR."
          icon={UserMultiple02Icon}
          actions={
            <Button asChild>
              <Link href="/app/qr" prefetch={false}>
                <Icon icon={QrCode01Icon} size={16} />
                Open your Poster kit
              </Link>
            </Button>
          }
        />
      }
    />
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function customersHighlightHref(membershipId: string, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    highlight: membershipId,
  })
  return `/app/customers?${params.toString()}`
}
