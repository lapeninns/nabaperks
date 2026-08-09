import { PlusSignIcon, UserMultiple02Icon } from "@hugeicons/core-free-icons"

import { adjustStampsAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminLookupControls,
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import {
  AdminEmptyState,
  AdminField,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
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
import type { getAdminCustomers } from "@/lib/admin/data"
import type { AdminLookupState } from "@/lib/admin/lookup-query"

type AdminCustomersResult = Awaited<ReturnType<typeof getAdminCustomers>>

export function CustomerMembershipsPanel({
  result,
  lookup,
  hrefForPage,
}: {
  readonly result: AdminCustomersResult | null
  readonly lookup: AdminLookupState
  readonly hrefForPage: (page: number) => string
}) {
  const searching = Boolean(lookup.venue || lookup.contact)

  return (
    <AdminPanel variant="flush">
      <AdminPanelHeader>
        <SectionHeader
          title="Memberships"
          description="Search every membership by venue or masked-contact fragment. Masked customer contacts and merchant-scoped stamp counters from service-role support reads."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
      </AdminPanelHeader>
      <AdminLookupControls
        sticky
        basePath="/admin/customers"
        lookup={lookup}
        label="Membership lookup"
      />
      {result ? (
        <>
          <DataTable
            caption="Admin customer membership support readback"
            cardBreakpoint="xl"
            className="rounded-none border-0 shadow-none"
            mobileClassName="p-5"
            rows={result.rows}
            getRowKey={(row) => row.id}
            emptyState={
              searching ? (
                <AdminEmptyState
                  icon={UserMultiple02Icon}
                  title="No matching memberships"
                  description="Adjust the venue or contact search, or clear it to see the newest memberships."
                />
              ) : (
                <AdminEmptyState
                  icon={UserMultiple02Icon}
                  title="No customer memberships yet"
                />
              )
            }
            mobileCard={(row) => {
              const customer = first(row.customers)
              const merchant = first(row.merchants)
              return (
                <AdminRecordCard
                  title={maskAdminCustomer(customer)}
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
                  action={
                    <AdminRecordActions
                      label="Adjust stamps"
                      group="membership-support"
                    >
                      <StampAdjustmentForm membershipId={row.id} />
                    </AdminRecordActions>
                  }
                />
              )
            }}
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
                        {maskAdminCustomer(customer)}
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
                    {row.current_stamp_count} current ·{" "}
                    {row.total_stamps_earned} total
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
                // Desktop folds the write form behind the same exclusive
                // disclosure the phone card already used: 25 always-open
                // two-field forms was ~4,000px of markup and 25 simultaneous
                // focusable field groups in the tab order, for an action taken
                // on roughly one row per session. The helper text now prints
                // once, inside the open panel.
                header: "Actions",
                cell: (row) => (
                  <AdminRecordActions
                    label="Adjust stamps"
                    group="membership-support-table"
                  >
                    <StampAdjustmentForm membershipId={row.id} />
                  </AdminRecordActions>
                ),
              },
            ]}
          />
          {result.meta.total > 0 ? (
            <AdminPanelFooter className="pt-0">
              <AdminLookupPagination
                label="Membership pages"
                unit="memberships"
                meta={result.meta}
                hrefForPage={hrefForPage}
              />
            </AdminPanelFooter>
          ) : null}
        </>
      ) : (
        <AdminPanelFooter className="pt-0">
          <AdminLookupErrorState title="Membership lookup unavailable" />
        </AdminPanelFooter>
      )}
    </AdminPanel>
  )
}

function StampAdjustmentForm({ membershipId }: { membershipId: string }) {
  return (
    <AdminActionForm
      action={adjustStampsAction}
      className="min-w-0 xl:min-w-[280px]"
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
        {/* min-w-0 lets each field shrink to its track — a bare number input's
            intrinsic width (~148px with spinners) otherwise overflows the
            96px delta column and overlaps Reason. */}
        <AdminField
          label="Delta"
          helper="Positive adds stamps, negative removes them."
          className="min-w-0"
        >
          <Input name="delta" type="number" required min={-25} max={25} />
        </AdminField>
        <AdminField label="Reason" className="min-w-0">
          <Input name="reason" required minLength={4} />
        </AdminField>
      </div>
      <SubmitButton pendingLabel="Adjusting…">
        <Icon icon={PlusSignIcon} size={16} />
        Adjust stamps
      </SubmitButton>
    </AdminActionForm>
  )
}
