import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { QrCode01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { EmptyState, Icon, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { MerchantCustomersTableSkeleton } from "@/components/merchant/loading-skeletons"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantCustomerPage } from "@/lib/merchant/dashboard"
import {
  buildCustomersHref,
  parseCustomerFilterParam,
  parseCustomerSearchParam,
  type CustomerFilter,
} from "@/lib/merchant/customers-filter"
import { loadMerchantCustomersView } from "@/lib/merchant/customers-view"
import { resolveCustomersPageRequest } from "@/lib/merchant/customers-paging"

export const dynamic = "force-dynamic"

type CustomersPageProps = {
  searchParams?: Promise<{
    highlight?: string | string[]
    page?: string | string[]
    filter?: string | string[]
    q?: string | string[]
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
  const filter = parseCustomerFilterParam(params.filter)
  const search = parseCustomerSearchParam(params.q)

  // Deep-link arrival only. `getMerchantCustomerPage` ranks the member inside
  // the UNFILTERED newest-first list, so it can only resolve a page while no
  // narrowing is active — with a filter or a search on, that rank names a row
  // in a different result set, so the redirect is skipped rather than sent to
  // the wrong page.
  if (!requestedPage && highlightedMembershipId) {
    const highlightedPage =
      filter === "all" && !search
        ? await getMerchantCustomerPage(merchant.id, highlightedMembershipId)
        : null

    if (highlightedPage && highlightedPage !== pageRequest.page) {
      redirect(customersHighlightHref(highlightedMembershipId, highlightedPage))
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
        // Keyed on the page only. A filter or search change re-renders this
        // boundary in place, which keeps the search field's focus and the
        // current rows on screen while the new ones load; keying it on the
        // narrowing too would remount the table on every debounced keystroke
        // and throw the caret out of the input.
        key={pageRequest.page}
        fallback={<MerchantCustomersTableSkeleton />}
      >
        <CustomersTableStream
          merchantId={merchant.id}
          page={pageRequest.page}
          filter={filter}
          search={search}
          highlightedMembershipId={highlightedMembershipId}
        />
      </Suspense>
    </div>
  )
}

async function CustomersTableStream({
  merchantId,
  page,
  filter,
  search,
  highlightedMembershipId,
}: {
  merchantId: string
  page: number
  filter: CustomerFilter
  search?: string
  highlightedMembershipId?: string
}) {
  // `loadMerchantCustomersView` masks every row inside lib/merchant/* and
  // returns the pre-masked view models, so raw email/phone never reach this
  // server component or the client bundle. Search and the status pills are
  // resolved there too (03#18) — they used to run in the browser over one
  // 15-row page, which made both silently wrong for any venue past page one.
  const view = await loadMerchantCustomersView({
    merchantId,
    page,
    filter,
    search,
  })

  return (
    <CustomerReadbackTable
      customers={view.rows}
      totalMembers={view.totalMembers}
      matchedMembers={view.matchedMembers}
      counts={view.counts}
      filter={filter}
      query={search ?? ""}
      capped={view.capped}
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
  return buildCustomersHref({ page, highlight: membershipId })
}
