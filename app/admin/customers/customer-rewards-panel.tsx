import { Cancel01Icon, GiftIcon } from "@hugeicons/core-free-icons"

import { cancelRewardAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import {
  AdminConfirmCheck,
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, Icon, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
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
    <AdminPanel className="p-0">
      <div className="border-b p-5">
        <SectionHeader
          title="Rewards"
          description="Assigned reward readbacks preserve customer masking and require a reason before cancellation."
          actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
        />
      </div>
      {result ? (
        <>
          <DataTable
            caption="Admin reward support readback"
            cardBreakpoint="xl"
            className="rounded-none border-0 shadow-none"
            mobileClassName="p-5"
            rows={result.rows}
            getRowKey={(reward) => reward.id}
            emptyState={
              <EmptyState
                icon={GiftIcon}
                title="No rewards yet"
                className="rounded-none border-0 shadow-none"
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
          {result.meta.total > 0 ? (
            <div className="p-5 pt-0">
              <AdminLookupPagination
                label="Reward pages"
                unit="reward events"
                meta={result.meta}
                hrefForPage={hrefForPage}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="p-5 pt-0">
          <AdminLookupErrorState title="Reward readback unavailable" />
        </div>
      )}
    </AdminPanel>
  )
}

function RewardCancelForm({ rewardId }: { rewardId: string }) {
  return (
    <AdminActionForm action={cancelRewardAction} className="min-w-[260px]">
      <input type="hidden" name="rewardId" value={rewardId} />
      <AdminField
        label="Reason"
        helper="Cancelling permanently removes this unlocked reward from the member; it cannot be undone. The action is written to the audit log."
      >
        <Input name="reason" required minLength={4} />
      </AdminField>
      <AdminConfirmCheck label="I understand this cancellation cannot be undone." />
      <SubmitButton pendingLabel="Cancelling…" variant="destructive">
        <Icon icon={Cancel01Icon} size={16} />
        Cancel reward
      </SubmitButton>
    </AdminActionForm>
  )
}
