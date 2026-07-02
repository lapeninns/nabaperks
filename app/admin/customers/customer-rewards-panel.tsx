import { Cancel01Icon, GiftIcon } from "@hugeicons/core-free-icons"

import { cancelRewardAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
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
import { SubmitButton } from "@/components/forms"
import type { getAdminRewards } from "@/lib/admin/data"

type AdminRewardsResult = Awaited<ReturnType<typeof getAdminRewards>>

export function CustomerRewardsPanel({
  result,
  hrefForPage,
}: {
  readonly result: AdminRewardsResult | null
  readonly hrefForPage: (page: number) => string
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Rewards"
        description="Assigned reward readbacks preserve customer masking and require a reason before cancellation."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {result ? (
        <>
          <DataTable
            caption="Admin reward support readback"
            cardBreakpoint="xl"
            className="rounded-lg shadow-none"
            rows={result.rows}
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
          <AdminLookupPagination
            label="Reward pages"
            unit="reward events"
            meta={result.meta}
            hrefForPage={hrefForPage}
          />
        </>
      ) : (
        <AdminLookupErrorState title="Reward readback unavailable" />
      )}
    </AdminPanel>
  )
}

function RewardCancelForm({ rewardId }: { rewardId: string }) {
  return (
    <AdminActionForm action={cancelRewardAction} className="min-w-[260px]">
      <input type="hidden" name="rewardId" value={rewardId} />
      <AdminField label="Reason">
        <input
          name="reason"
          required
          minLength={4}
          className={adminInputClasses}
        />
      </AdminField>
      <SubmitButton pendingLabel="Cancelling…" variant="destructive">
        <Icon icon={Cancel01Icon} size={16} />
        Cancel reward
      </SubmitButton>
    </AdminActionForm>
  )
}
