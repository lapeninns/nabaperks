import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminEmptyState,
  AdminPanel,
  SourceLabel,
  StatusPill,
  formatAdminDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { SectionHeader } from "@/components/brand"
import type { getAdminUnaffiliatedCustomers } from "@/lib/admin/data"
import type { AdminLookupState } from "@/lib/admin/lookup-query"
import { Shield01Icon } from "@hugeicons/core-free-icons"

type UnaffiliatedResult = Awaited<
  ReturnType<typeof getAdminUnaffiliatedCustomers>
>
type UnaffiliatedRow = UnaffiliatedResult["rows"][number]

/**
 * Verified customers who never joined a venue (db privacy lifecycle). The
 * membership-based lookups above cannot surface them, so admins had no way to
 * discover or service a verified account with no membership. Reuses the page's
 * contact search; read-only, service-role readback.
 */
export function UnaffiliatedCustomersPanel({
  result,
  lookup,
  hrefForPage,
}: {
  readonly result: UnaffiliatedResult | null
  readonly lookup: AdminLookupState
  readonly hrefForPage: (page: number) => string
}) {
  const searching = Boolean(lookup.contact)

  return (
    <AdminPanel>
      <SectionHeader
        title="Verified customers without a membership"
        description="Verified customers who signed up but never joined a venue — invisible to the membership lookups. Search by contact fragment."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {/* This list used to be governed by a control in another panel
          thousands of pixels above it, signposted only by a sentence. It owns
          its search now. */}
      <AdminLookupControls
        basePath="/admin/privacy"
        lookup={lookup}
        label="Unaffiliated customer lookup"
        fields="contact"
        hiddenParams={{ panel: "unaffiliated" }}
      />
      <AdminAppliedFilters
        basePath="/admin/privacy"
        lookup={{ ...lookup, venue: undefined }}
        extraParams={{ panel: "unaffiliated" }}
      />
      {result ? (
        result.rows.length ? (
          <>
            <div className="grid gap-3">
              {result.rows.map((row) => (
                <UnaffiliatedRecord key={row.id} row={row} />
              ))}
            </div>
            <AdminLookupPagination
              label="Unaffiliated customer pages"
              unit="customers"
              meta={result.meta}
              hrefForPage={hrefForPage}
            />
          </>
        ) : searching ? (
          <AdminEmptyState
            icon={Shield01Icon}
            title="No matching customers"
            description="No unaffiliated customer matches that contact fragment."
            padded={false}
          />
        ) : (
          <AdminEmptyState
            icon={Shield01Icon}
            title="No unaffiliated customers"
            description="Every verified customer has joined at least one venue."
            padded={false}
          />
        )
      ) : (
        <AdminLookupErrorState title="Unaffiliated lookup unavailable" />
      )}
    </AdminPanel>
  )
}

function UnaffiliatedRecord({ row }: { readonly row: UnaffiliatedRow }) {
  return (
    <AdminRecordCard
      title={maskAdminCustomer(row)}
      status={
        row.is_verified ? <StatusPill tone="good">Verified</StatusPill> : null
      }
      fields={[
        { label: "Signed up", value: formatAdminDate(row.created_at) },
        {
          label: "References",
          value: <AdminIdChip value={row.id} prefix="customer" />,
        },
      ]}
    />
  )
}
