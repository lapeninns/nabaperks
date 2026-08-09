import {
  AlertDiamondIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import { resolveFraudFlagAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminEmptyState,
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  formatAdminAction,
  formatAdminAuditDate,
} from "@/components/admin/support"
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { Icon, SectionHeader, type IconGlyph } from "@/components/brand"
import { DataTable, type DataTableSort } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import type { getAdminFraudFlags } from "@/lib/admin/data"
import type {
  AdminLookupState,
  AdminPageMeta,
} from "@/lib/admin/lookup-query"

type FraudFlags = Awaited<ReturnType<typeof getAdminFraudFlags>>["rows"]
type FraudFlag = FraudFlags[number]

/**
 * fraud_flags.severity check constraint: low/medium/high. Tone-map severity
 * so triage-by-scan works — high reads as danger, medium as warning, low as
 * neutral — instead of every severity rendering identical amber.
 */
const SEVERITY_TONE: Record<string, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
}

function severityTone(severity: string) {
  return SEVERITY_TONE[severity.toLowerCase()] ?? "warning"
}

const QUEUE_DESCRIPTION: Record<string, string> = {
  open: "Open flags only, highest severity first. Masked customer context and bucketed location evidence.",
  high: "Every high-severity flag, open or resolved, newest first.",
  all: "Every flag, highest severity first, including reviewed and dismissed.",
}

export function FraudFlagsPanel({
  flags,
  meta,
  lookup,
  queue = "open",
  hrefForPage,
  sort,
}: {
  readonly flags: FraudFlags
  readonly meta: AdminPageMeta
  readonly lookup: AdminLookupState
  readonly queue?: string
  readonly hrefForPage: (page: number) => string
  readonly sort?: DataTableSort
}) {
  const searching = Boolean(lookup.venue)

  return (
    <AdminPanel>
      <SectionHeader
        title="Fraud flags"
        description={QUEUE_DESCRIPTION[queue] ?? QUEUE_DESCRIPTION.all}
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {/* The queue was the newest 100 flags with no filter and a truncation
          notice, because severity could only be ordered in memory (04#6). The
          rank is a generated column now, so this list pages like its siblings.
          Venue only: `fraud_flags.customer_id` is nullable, so a contact
          fragment would need an inner join that silently drops customer-less
          flags — exactly the anomaly rows this queue exists for. */}
      <AdminLookupControls
        sticky="padded"
        basePath="/admin/fraud"
        lookup={lookup}
        label="Fraud flag lookup"
        fields="venue"
        hiddenParams={{ queue: queue === "open" ? undefined : queue }}
      />
      <AdminAppliedFilters
        basePath="/admin/fraud"
        lookup={lookup}
        extraParams={{ queue: queue === "open" ? undefined : queue }}
      />
      <DataTable
        caption="Admin fraud flag readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={flags}
        sort={sort}
        getRowKey={(flag) => flag.id}
        emptyState={
          <AdminEmptyState
            icon={AlertDiamondIcon}
            title={
              searching
                ? "No matching fraud flags"
                : queue === "open"
                  ? "No open fraud flags"
                  : "No fraud flags yet"
            }
            description={
              searching
                ? "No flag in this queue belongs to a venue whose name contains that fragment. Clear the search, or switch queue."
                : queue === "open"
                  ? "Nothing is waiting for review. Switch to All flags to read resolved ones."
                  : undefined
            }
            padded={false}
          />
        }
        columns={[
          {
            key: "signal",
            header: "Signal",
            cell: (flag) => (
              <span className="font-bold">
                {formatAdminAction(flag.signal)}
              </span>
            ),
          },
          {
            key: "context",
            header: "Context",
            cell: (flag) => (
              <div className="grid gap-1">
                <span className="font-bold">{flag.merchant}</span>
                <span className="text-muted-foreground">
                  {flag.maskedCustomer}
                </span>
              </div>
            ),
          },
          {
            key: "evidence",
            header: "Evidence",
            cell: (flag) => <FraudFlagEvidence flag={flag} />,
          },
          {
            key: "severity",
            header: "Severity",
            // Sortable because `severity_rank` exists (04#6): before it, a
            // severity sort could only have been an in-memory sort of one page.
            sortKey: "severity",
            cell: (flag) => (
              <StatusPill tone={severityTone(flag.severity)}>
                {flag.severity}
              </StatusPill>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (flag) => <StatusPill>{flag.status}</StatusPill>,
          },
          {
            key: "when",
            header: "When",
            sortKey: "when",
            cell: (flag) => (
              <time
                className="text-muted-foreground"
                dateTime={flag.created_at}
              >
                {formatAdminAuditDate(flag.created_at)}
              </time>
            ),
          },
          {
            key: "actions",
            // Two complete write forms per row, each with a required text
            // input, made a triage row ~250px tall — a 100-flag queue was a
            // ~26,000px page you could not scan. Both forms now live behind
            // the same exclusive disclosure the phone card uses.
            header: "Actions",
            cell: (flag) => (
              <AdminRecordActions
                label="Review actions"
                group="fraud-review-table"
              >
                <FraudFlagActions flagId={flag.id} />
              </AdminRecordActions>
            ),
          },
        ]}
        mobileCard={(flag) => (
          <AdminRecordCard
            title={formatAdminAction(flag.signal)}
            status={
              <>
                <StatusPill tone={severityTone(flag.severity)}>
                  {flag.severity}
                </StatusPill>
                <StatusPill>{flag.status}</StatusPill>
              </>
            }
            fields={[
              { label: "Merchant", value: flag.merchant },
              { label: "Customer", value: flag.maskedCustomer },
              { label: "Evidence", value: <FraudFlagEvidence flag={flag} /> },
              {
                label: "When",
                value: (
                  <time dateTime={flag.created_at}>
                    {formatAdminAuditDate(flag.created_at)}
                  </time>
                ),
              },
            ]}
            action={
              <AdminRecordActions label="Review actions" group="fraud-review">
                <FraudFlagActions flagId={flag.id} />
              </AdminRecordActions>
            }
          />
        )}
      />
      {meta.total > 0 ? (
        <AdminLookupPagination
          label="Fraud flag pages"
          unit="flags in this queue"
          meta={meta}
          hrefForPage={hrefForPage}
        />
      ) : null}
    </AdminPanel>
  )
}

/**
 * Stacked evidence cell (ADM-P1-04): folds reason, location status, distance,
 * accuracy, confidence, and the cycle stamp into one column so the desktop
 * table stays scannable at 1280px with identity and review actions
 * co-visible, instead of the previous 13-column horizontal scroll.
 */
function FraudFlagEvidence({ flag }: { readonly flag: FraudFlag }) {
  return (
    <div className="grid min-w-44 gap-1 text-xs leading-5">
      <span className="font-semibold text-foreground">
        {formatAdminAction(flag.reason)}
      </span>
      <span className="text-muted-foreground">
        location {flag.locationStatus.replaceAll("_", " ")} · distance{" "}
        {flag.distanceBucket} · accuracy {flag.accuracyBucket}
      </span>
      <span className="text-muted-foreground">
        confidence {flag.confidence}
        {flag.cycleStampNumber !== null
          ? ` · cycle stamp ${flag.cycleStampNumber}`
          : ""}
      </span>
    </div>
  )
}

function FraudFlagActions({ flagId }: { readonly flagId: string }) {
  return (
    <div className="grid gap-2">
      <FraudFlagResolutionForm
        flagId={flagId}
        status="reviewed"
        label="Mark reviewed"
        icon={CheckmarkCircle02Icon}
      />
      <FraudFlagResolutionForm
        flagId={flagId}
        status="dismissed"
        label="Dismiss"
        icon={Cancel01Icon}
        variant="secondary"
      />
    </div>
  )
}

function FraudFlagResolutionForm({
  flagId,
  status,
  label,
  icon,
  variant = "default",
}: {
  readonly flagId: string
  readonly status: "reviewed" | "dismissed"
  readonly label: string
  readonly icon: IconGlyph
  readonly variant?: "default" | "secondary"
}) {
  return (
    <AdminActionForm action={resolveFraudFlagAction}>
      <input type="hidden" name="fraudFlagId" value={flagId} />
      <input type="hidden" name="status" value={status} />
      <AdminField
        label={status === "reviewed" ? "Review reason" : "Dismissal reason"}
      >
        <Input name="reason" required minLength={4} />
      </AdminField>
      <SubmitButton
        pendingLabel="Saving…"
        variant={variant}
        className="justify-start"
      >
        <Icon icon={icon} size={16} />
        {label}
      </SubmitButton>
    </AdminActionForm>
  )
}
