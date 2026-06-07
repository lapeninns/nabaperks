import { redirect } from "next/navigation"

import { EmptyState, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantCustomers } from "@/lib/merchant/dashboard"

export default async function MerchantCustomersPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const customers = await getMerchantCustomers(merchant.id)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Customers"
        title="Loyalty members"
        description="Current stamp progress and reward totals for this merchant."
      />

      <CustomerReadbackTable
        customers={customers}
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
