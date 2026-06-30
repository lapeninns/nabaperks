import { Cancel01Icon, GiftIcon } from "@hugeicons/core-free-icons"

import { cancelRewardAction } from "@/app/admin/actions"
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
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, Icon, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import type { getAdminRewards } from "@/lib/admin/data"

type AdminRewards = Awaited<ReturnType<typeof getAdminRewards>>

export function CustomerRewardsPanel({
  rewards,
}: {
  readonly rewards: AdminRewards
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Rewards"
        description="Assigned reward readbacks preserve customer masking and require a reason before cancellation."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      <DataTable
        caption="Admin reward support readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={rewards}
        getRowKey={(reward) => reward.id}
        emptyState={
          <EmptyState
            icon={GiftIcon}
            title="No rewards yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        }
        mobileCard={(reward) => {
          const loyaltyCard = first(reward.loyalty_cards)
          const customer = first(reward.customers)
          const merchant = first(reward.merchants)
          const canCancel =
            reward.status !== "redeemed" && reward.status !== "cancelled"
          return (
            <AdminRecordCard
              title={loyaltyCard?.reward_name ?? "Reward"}
              status={<StatusPill>{reward.status}</StatusPill>}
              fields={[
                {
                  label: "Context",
                  value: (
                    <>
                      {merchant?.business_name ?? "Merchant"} ·{" "}
                      {maskAdminContact(customer?.email ?? customer?.phone)}
                    </>
                  ),
                },
                {
                  label: "Created",
                  mono: true,
                  value: (
                    <time dateTime={reward.created_at}>
                      {formatAdminDate(reward.created_at)}
                    </time>
                  ),
                },
              ]}
              action={
                canCancel ? (
                  <RewardCancelForm rewardId={reward.id} />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No action available
                  </span>
                )
              }
            />
          )
        }}
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
              reward.status !== "redeemed" &&
              reward.status !== "cancelled" ? (
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
        <Icon icon={Cancel01Icon} size={16} />
        Cancel reward
      </Button>
    </form>
  )
}
