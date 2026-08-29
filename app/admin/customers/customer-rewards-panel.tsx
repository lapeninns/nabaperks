import { Cancel01Icon, GiftIcon } from "@hugeicons/core-free-icons"

import { cancelRewardAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import {
  AdminConfirmCheck,
  AdminEmptyState,
  AdminField,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import { Icon, SectionHeader } from "@/components/brand"
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
    <AdminPanel variant="flush">
      <AdminPanelHeader>
        <SectionHeader
          title="Rewards"
          description="Assigned reward readbacks preserve customer masking and require a reason before cancellation."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
      </AdminPanelHeader>
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
              <AdminEmptyState icon={GiftIcon} title="No rewards yet" />
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
                          {maskAdminCustomer(customer)}
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
                      <AdminRecordActions
                        label="Cancel reward"
                        group="reward-support"
                      >
                        <RewardCancelForm rewardId={reward.id} />
                      </AdminRecordActions>
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
                      {maskAdminCustomer(customer)}
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
                // 25 armed destructive forms on screen at once is a mis-click
                // surface, not a safety design, and the irreversibility copy
                // loses all weight through repetition. The reason field, the
                // confirmation gate and the danger copy now appear once, at
                // the moment of decision, behind an exclusive disclosure.
                // Ineligible rows keep the column one shape with an em dash.
                header: "Actions",
                cell: (reward) =>
                  reward.status !== "redeemed" &&
                  reward.status !== "cancelled" ? (
                    <AdminRecordActions
                      label="Cancel reward"
                      group="reward-support-table"
                    >
                      <RewardCancelForm rewardId={reward.id} />
                    </AdminRecordActions>
                  ) : (
                    <span
                      className="text-sm text-muted-foreground"
                      title="No action available"
                    >
                      —<span className="sr-only">No action available</span>
                    </span>
                  ),
              },
            ]}
          />
          {result.meta.total > 0 ? (
            <AdminPanelFooter className="pt-0">
              <AdminLookupPagination
                label="Reward pages"
                unit="reward events"
                meta={result.meta}
                hrefForPage={hrefForPage}
              />
            </AdminPanelFooter>
          ) : null}
        </>
      ) : (
        <AdminPanelFooter className="pt-0">
          <AdminLookupErrorState title="Reward readback unavailable" />
        </AdminPanelFooter>
      )}
    </AdminPanel>
  )
}

function RewardCancelForm({ rewardId }: { rewardId: string }) {
  return (
    <AdminActionForm
      action={cancelRewardAction}
      className="min-w-0 xl:min-w-[260px]"
    >
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
