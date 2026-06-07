import { redirect } from "next/navigation"

import { EmptyState, PageTitle } from "@/components/brand"
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

      <section className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        {customers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Current stamps</th>
                  <th className="px-4 py-3">Total stamps</th>
                  <th className="px-4 py-3">Rewards redeemed</th>
                  <th className="px-4 py-3">Last visit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-bold">
                      {row.customer.email ?? row.customer.phone ?? "Customer"}
                    </td>
                    <td className="px-4 py-3">{row.current_stamp_count}</td>
                    <td className="px-4 py-3">{row.total_stamps_earned}</td>
                    <td className="px-4 py-3">{row.total_rewards_redeemed}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.last_visit_at ? formatDate(row.last_visit_at) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No customers yet"
            description="Customers will appear here after they join from the venue QR."
            className="rounded-none border-0 shadow-none"
          />
        )}
      </section>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
