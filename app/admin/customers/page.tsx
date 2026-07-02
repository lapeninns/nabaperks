import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminCustomers, getAdminRewards } from "@/lib/admin/data"
import {
  buildLookupHref,
  parseAdminLookupParams,
  parsePageParam,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

import { CustomerMembershipsPanel } from "./customer-memberships-panel"
import { CustomerRewardsPanel } from "./customer-rewards-panel"

type AdminCustomersPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

/**
 * Member lookup surface (MS-admin-member-lookup): query params drive the
 * server-side search and pagination so any membership — not just the newest
 * 100 — is reachable and every result view is linkable. Read failures render
 * inline per panel (R4) instead of replacing the console with the segment
 * error boundary.
 */
export default async function AdminCustomersPage({
  searchParams,
}: AdminCustomersPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)
  const rewardsPage = parsePageParam(params.rewardsPage)

  const [memberships, rewards] = await Promise.all([
    getAdminCustomers(lookup).catch((error: unknown) => {
      console.error("Admin membership lookup failed", error)
      return null
    }),
    getAdminRewards(rewardsPage).catch((error: unknown) => {
      console.error("Admin rewards readback failed", error)
      return null
    }),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Customers"
        description="Customer lookup with audited stamp and reward support actions."
      />

      <CustomerMembershipsPanel
        result={memberships}
        lookup={lookup}
        hrefForPage={(page) =>
          buildLookupHref("/admin/customers", {
            venue: lookup.venue,
            contact: lookup.contact,
            page,
            rewardsPage,
          })
        }
      />
      <CustomerRewardsPanel
        result={rewards}
        hrefForPage={(page) =>
          buildLookupHref("/admin/customers", {
            venue: lookup.venue,
            contact: lookup.contact,
            page: lookup.page,
            rewardsPage: page,
          })
        }
      />
    </div>
  )
}
