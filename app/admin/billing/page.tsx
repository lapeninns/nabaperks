import { EmptyState, PageTitle } from "@/components/brand"
import { getAdminBillingRecords } from "@/lib/admin/data"

export default async function AdminBillingPage() {
  const billing = await getAdminBillingRecords()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Billing"
        description="Stripe subscription state synced into Supabase."
      />

      <section className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        {billing.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Period end</th>
                  <th className="px-4 py-3">Stripe subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {billing.map((row) => {
                  const merchant = first(row.merchants)
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-bold">
                        {merchant?.business_name ?? "Merchant"}
                      </td>
                      <td className="px-4 py-3">{row.plan}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.current_period_end
                          ? formatDate(row.current_period_end)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.stripe_subscription_id ?? "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No billing records yet"
            className="rounded-none border-0 shadow-none"
          />
        )}
      </section>
    </div>
  )
}

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value)
  )
}
