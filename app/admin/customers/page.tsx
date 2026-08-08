import { Suspense } from "react"

import { AdminTableSkeleton } from "@/components/admin/skeletons"
import { AdminViewTabs } from "@/components/admin/view-tabs"
import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminCustomers, getAdminRewards } from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminLookupParams,
  parsePageParam,
  type AdminLookupState,
  type AdminSearchParamValue,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

import { CustomerMembershipsPanel } from "./customer-memberships-panel"
import { CustomerRewardsPanel } from "./customer-rewards-panel"

export const metadata = { title: "Admin — Customers" }

type AdminCustomersPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

const CUSTOMER_VIEWS = ["memberships", "rewards"] as const
type CustomerView = (typeof CUSTOMER_VIEWS)[number]

/** Unknown/absent `?view=` falls back to memberships. */
function parseCustomerView(value: AdminSearchParamValue): CustomerView {
  const raw = Array.isArray(value) ? value[0] : value
  return CUSTOMER_VIEWS.includes(raw as CustomerView)
    ? (raw as CustomerView)
    : "memberships"
}

/**
 * Member lookup surface (admin member lookup): query params drive the
 * server-side search and pagination so any membership — not just the newest
 * 100 — is reachable and every result view is linkable. Read failures render
 * inline per panel (R4) instead of replacing the console with the segment
 * error boundary.
 *
 * Memberships and rewards are two independently paginated lists, so having
 * both on one scroll surface meant paging rewards returned the operator to
 * the top of ~4,000px of memberships, and the shared search silently applied
 * to only one of them. They are segmented views on `?view=` instead: one
 * list, one paginator and one search box on screen, and only the active view
 * is read from the database (behind the page gate, which runs first).
 */
export default async function AdminCustomersPage({
  searchParams,
}: AdminCustomersPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const view = parseCustomerView(params.view)
  const rewardsPage = parsePageParam(params.rewardsPage)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Customers"
        description="Customer lookup with audited stamp and reward support actions."
      />

      <AdminViewTabs
        label="Customer views"
        activeId={view}
        tabs={[
          {
            id: "memberships",
            label: "Memberships",
            href: buildLookupHref("/admin/customers", {
              venue: lookup.venue,
              contact: lookup.contact,
              size: lookup.size,
            }),
          },
          {
            id: "rewards",
            label: "Rewards",
            href: buildLookupHref("/admin/customers", {
              view: "rewards",
              venue: lookup.venue,
              contact: lookup.contact,
              size: lookup.size,
            }),
          },
        ]}
      />

      {/* The list streams behind its own boundary so the title, tabs and
          search paint before the service-role readback resolves. */}
      <Suspense fallback={<AdminTableSkeleton />}>
        {view === "memberships" ? (
          <MembershipsView lookup={lookup} />
        ) : (
          <RewardsView rewardsPage={rewardsPage} size={lookup.size} />
        )}
      </Suspense>
    </div>
  )
}

async function MembershipsView({
  lookup,
}: {
  readonly lookup: AdminLookupState
}) {
  const memberships = await getAdminCustomers(lookup).catch(
    (error: unknown) => {
      console.error("Admin membership lookup failed", error)
      return null
    }
  )

  return (
    <CustomerMembershipsPanel
      result={memberships}
      lookup={lookup}
      hrefForPage={(page) =>
        buildLookupHref("/admin/customers", {
          venue: lookup.venue,
          contact: lookup.contact,
          page,
          size: lookup.size,
        })
      }
    />
  )
}

async function RewardsView({
  rewardsPage,
  size,
}: {
  readonly rewardsPage: number
  readonly size: number
}) {
  const rewards = await getAdminRewards(rewardsPage, size).catch(
    (error: unknown) => {
      console.error("Admin rewards readback failed", error)
      return null
    }
  )

  return (
    <CustomerRewardsPanel
      result={rewards}
      hrefForPage={(page) =>
        buildLookupHref("/admin/customers", {
          view: "rewards",
          rewardsPage: page,
          size,
        })
      }
    />
  )
}
