import { adjustStampsAction, cancelRewardAction } from "@/app/admin/actions"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  adminInputClasses,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
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

      <AdminPanel>
        <SectionHeader
          title="Memberships"
          description="Masked customer contacts and merchant-scoped stamp counters from service-role support reads."
          actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
        />
        <DataTable
          caption="Admin customer membership support readback"
          className="rounded-2xl shadow-none"
          rows={customers}
          getRowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title="No customer memberships yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          columns={[
            {
              key: "customer",
              header: "Customer",
              cell: (row) => {
                const customer = first(row.customers)
                const merchant = first(row.merchants)
                return (
                  <div className="grid gap-1">
                    <span className="font-bold">
                      {maskAdminContact(customer?.email ?? customer?.phone)}
                    </span>
                    <span className="text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"}
                    </span>
                  </div>
                )
              },
            },
            {
              key: "stamps",
              header: "Stamps",
              cell: (row) => (
                <span className="numeric-tabular">
                  {row.current_stamp_count} current · {row.total_stamps_earned} total
                </span>
              ),
            },
            {
              key: "rewards",
              header: "Rewards redeemed",
              cell: (row) => (
                <span className="numeric-tabular">
                  {row.total_rewards_redeemed}
                </span>
              ),
            },
            {
              key: "joined",
              header: "Joined",
              cell: (row) => (
                <time className="text-muted-foreground" dateTime={row.created_at}>
                  {formatAdminDate(row.created_at)}
                </time>
              ),
            },
            {
              key: "action",
              header: "Audited action",
              cell: (row) => <StampAdjustmentForm membershipId={row.id} />,
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Rewards"
          description="Assigned reward readbacks preserve customer masking and require a reason before cancellation."
          actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
        />
        <DataTable
          caption="Admin reward support readback"
          className="rounded-2xl shadow-none"
          rows={rewards}
          getRowKey={(reward) => reward.id}
          emptyState={
            <EmptyState
              title="No rewards yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          columns={[
            {
              key: "reward",
              header: "Reward",
              cell: (reward) => {
                const loyaltyCard = first(reward.loyalty_cards)
                return (
                  <span className="font-bold">
                    {loyaltyCard?.reward_name ?? "Reward"}
                  </span>
                )
              },
            },
            {
              key: "context",
              header: "Context",
              cell: (reward) => {
                const customer = first(reward.customers)
                const merchant = first(reward.merchants)
                return (
                  <span className="text-muted-foreground">
                    {merchant?.business_name ?? "Merchant"} ·{" "}
                    {maskAdminContact(customer?.email ?? customer?.phone)}
                  </span>
                )
              },
            },
            {
              key: "status",
              header: "Status",
              cell: (reward) => <StatusPill>{reward.status}</StatusPill>,
            },
            {
              key: "created",
              header: "Created",
              cell: (reward) => (
                <time
                  className="text-muted-foreground"
                  dateTime={reward.created_at}
                >
                  {formatAdminDate(reward.created_at)}
                </time>
              ),
            },
            {
              key: "action",
              header: "Audited action",
              cell: (reward) =>
                reward.status !== "redeemed" && reward.status !== "cancelled" ? (
                  <RewardCancelForm rewardId={reward.id} />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No action available
                  </span>
                ),
            },
          ]}
        />
      </AdminPanel>
    </div>
  )
}

function StampAdjustmentForm({ membershipId }: { membershipId: string }) {
  return (
    <form action={adjustStampsAction} className="grid min-w-[280px] gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="grid gap-2 sm:grid-cols-[96px_1fr]">
        <AdminField label="Delta">
          <input
            name="delta"
            type="number"
            required
            className={adminInputClasses}
          />
        </AdminField>
        <AdminField label="Reason">
          <input
            name="reason"
            required
            minLength={4}
            className={adminInputClasses}
          />
        </AdminField>
      </div>
      <Button type="submit">Adjust stamps</Button>
    </form>
  )
}

function RewardCancelForm({ rewardId }: { rewardId: string }) {
  return (
    <form action={cancelRewardAction} className="grid min-w-[260px] gap-2">
      <input type="hidden" name="rewardId" value={rewardId} />
      <AdminField label="Reason">
        <input
          name="reason"
          required
          minLength={4}
          className={adminInputClasses}
        />
      </AdminField>
      <Button type="submit" variant="destructive">
        Cancel reward
      </Button>
    </form>
  )
}
