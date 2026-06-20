import {
  Cancel01Icon,
  GiftIcon,
  PlusSignIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

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
import { EmptyState, Icon, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import {
  ADMIN_CUSTOMERS,
  ADMIN_REWARDS,
  type AdminCustomerRow,
  type AdminRewardRow,
} from "./mock-data"
import { PreviewActionForm } from "./preview-forms"

/**
 * Mirror of `/admin/customers`. Reuses the real membership and reward
 * `DataTable`s with `maskAdminContact` masking contacts exactly as the live
 * page. Stamp-adjust and reward-cancel forms render statically (disabled).
 *
 * `empty` swaps both readbacks to `[]` so each `DataTable` renders its real
 * `EmptyState` (no broken table shell) — the empty-state preview variant.
 */
export function AdminCustomersScreen({ empty = false }: { empty?: boolean }) {
  const customers = empty ? [] : ADMIN_CUSTOMERS
  const rewards = empty ? [] : ADMIN_REWARDS

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
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
        <DataTable
          caption="Admin customer membership support readback"
          cardBreakpoint="lg"
          className="rounded-lg shadow-none"
          rows={customers}
          getRowKey={(row: AdminCustomerRow) => row.id}
          emptyState={
            <EmptyState
              icon={UserMultiple02Icon}
              title="No customer memberships yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          mobileCard={(row: AdminCustomerRow) => {
            const customer = first(row.customers)
            const merchant = first(row.merchants)
            return (
              <AdminRecordCard
                title={maskAdminContact(customer?.email ?? customer?.phone)}
                fields={[
                  {
                    label: "Merchant",
                    value: merchant?.business_name ?? "Merchant",
                  },
                  {
                    label: "Stamps",
                    value: (
                      <span className="numeric-tabular">
                        {row.current_stamp_count} current ·{" "}
                        {row.total_stamps_earned} total
                      </span>
                    ),
                  },
                  {
                    label: "Rewards redeemed",
                    value: (
                      <span className="numeric-tabular">
                        {row.total_rewards_redeemed}
                      </span>
                    ),
                  },
                  {
                    label: "Joined",
                    mono: true,
                    value: (
                      <time dateTime={row.created_at}>
                        {formatAdminDate(row.created_at)}
                      </time>
                    ),
                  },
                ]}
                action={<PreviewStampForm />}
              />
            )
          }}
          columns={[
            {
              key: "customer",
              header: "Customer",
              cell: (row: AdminCustomerRow) => {
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
              cell: (row: AdminCustomerRow) => (
                <span className="numeric-tabular">
                  {row.current_stamp_count} current · {row.total_stamps_earned}{" "}
                  total
                </span>
              ),
            },
            {
              key: "rewards",
              header: "Rewards redeemed",
              cell: (row: AdminCustomerRow) => (
                <span className="numeric-tabular">
                  {row.total_rewards_redeemed}
                </span>
              ),
            },
            {
              key: "joined",
              header: "Joined",
              cell: (row: AdminCustomerRow) => (
                <time
                  className="text-muted-foreground"
                  dateTime={row.created_at}
                >
                  {formatAdminDate(row.created_at)}
                </time>
              ),
            },
            {
              key: "action",
              header: "Audited action",
              cell: () => <PreviewStampForm />,
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Rewards"
          description="Assigned reward readbacks preserve customer masking and require a reason before cancellation."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
        <DataTable
          caption="Admin reward support readback"
          cardBreakpoint="lg"
          className="rounded-lg shadow-none"
          rows={rewards}
          getRowKey={(reward: AdminRewardRow) => reward.id}
          emptyState={
            <EmptyState
              icon={GiftIcon}
              title="No rewards yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          mobileCard={(reward: AdminRewardRow) => {
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
                    <PreviewRewardCancelForm />
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
              cell: (reward: AdminRewardRow) => {
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
              cell: (reward: AdminRewardRow) => {
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
              cell: (reward: AdminRewardRow) => (
                <StatusPill>{reward.status}</StatusPill>
              ),
            },
            {
              key: "created",
              header: "Created",
              cell: (reward: AdminRewardRow) => (
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
              cell: (reward: AdminRewardRow) =>
                reward.status !== "redeemed" &&
                reward.status !== "cancelled" ? (
                  <PreviewRewardCancelForm />
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

function PreviewStampForm() {
  return (
    <PreviewActionForm className="grid min-w-[280px] gap-2">
      <div className="grid gap-2 sm:grid-cols-[96px_1fr]">
        <AdminField label="Delta">
          <input type="number" className={adminInputClasses} disabled />
        </AdminField>
        <AdminField label="Reason">
          <input className={adminInputClasses} disabled />
        </AdminField>
      </div>
      <Button type="button" disabled>
        <Icon icon={PlusSignIcon} size={16} />
        Adjust stamps
      </Button>
    </PreviewActionForm>
  )
}

function PreviewRewardCancelForm() {
  return (
    <PreviewActionForm className="grid min-w-[260px] gap-2">
      <AdminField label="Reason">
        <input className={adminInputClasses} disabled />
      </AdminField>
      <Button type="button" variant="destructive" disabled>
        <Icon icon={Cancel01Icon} size={16} />
        Cancel reward
      </Button>
    </PreviewActionForm>
  )
}
