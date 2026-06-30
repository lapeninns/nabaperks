import { PageTitle } from "@/components/brand"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminCustomers, getAdminRewards } from "@/lib/admin/data"

import { CustomerMembershipsPanel } from "./customer-memberships-panel"
import { CustomerRewardsPanel } from "./customer-rewards-panel"

export default async function AdminCustomersPage() {
  if (!(await canRenderAdminPage())) return null

  const [customers, rewards] = await Promise.all([
    getAdminCustomers(),
    getAdminRewards(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Customers"
        description="Limited customer lookup with audited stamp and reward support actions."
      />

      <CustomerMembershipsPanel customers={customers} />
      <CustomerRewardsPanel rewards={rewards} />
    </div>
  )
}
