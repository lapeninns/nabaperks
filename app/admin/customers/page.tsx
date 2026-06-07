import { adjustStampsAction, cancelRewardAction } from "@/app/admin/actions"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getAdminCustomers, getAdminRewards } from "@/lib/admin/data"

export default async function AdminCustomersPage() {
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

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader title="Memberships" />
        {customers.length ? (
          <div className="grid gap-3">
            {customers.map((row) => {
              const customer = first(row.customers)
              const merchant = first(row.merchants)
              return (
                <article
                  key={row.id}
                  className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_320px]"
                >
                  <div>
                    <p className="font-bold">
                      {maskContact(customer?.email ?? customer?.phone)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"} ·{" "}
                      {row.current_stamp_count} current stamps ·{" "}
                      {row.total_rewards_redeemed} rewards redeemed
                    </p>
                  </div>
                  <form action={adjustStampsAction} className="grid gap-2">
                    <input type="hidden" name="membershipId" value={row.id} />
                    <div className="grid grid-cols-[96px_1fr] gap-2">
                      <input
                        name="delta"
                        type="number"
                        placeholder="+1"
                        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
                      />
                      <input
                        name="reason"
                        placeholder="Reason"
                        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
                      />
                    </div>
                    <Button type="submit" size="sm">
                      Adjust stamps
                    </Button>
                  </form>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No customer memberships yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader title="Rewards" />
        {rewards.length ? (
          <div className="grid gap-3">
            {rewards.map((reward) => {
              const customer = first(reward.customers)
              const merchant = first(reward.merchants)
              const loyaltyCard = first(reward.loyalty_cards)
              return (
                <article
                  key={reward.id}
                  className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_320px]"
                >
                  <div>
                    <p className="font-bold">
                      {loyaltyCard?.reward_name ?? "Reward"} · {reward.status}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"} ·{" "}
                      {maskContact(customer?.email ?? customer?.phone)}
                    </p>
                  </div>
                  {reward.status !== "redeemed" &&
                  reward.status !== "cancelled" ? (
                    <form action={cancelRewardAction} className="grid gap-2">
                      <input type="hidden" name="rewardId" value={reward.id} />
                      <input
                        name="reason"
                        placeholder="Cancellation reason"
                        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
                      />
                      <Button type="submit" variant="destructive" size="sm">
                        Cancel reward
                      </Button>
                    </form>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No rewards yet"
            className="rounded-none border-0 p-0 shadow-none"
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

function maskContact(value?: string | null) {
  if (!value) return "Customer"
  if (value.includes("@")) {
    const [name, domain] = value.split("@")
    return `${name.slice(0, 2)}***@${domain}`
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}
