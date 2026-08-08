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
import { Icon, SectionHeader, type IconGlyph } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import type { getAdminFraudSignals } from "@/lib/admin/data"

type FraudFlags = Awaited<ReturnType<typeof getAdminFraudSignals>>["fraudFlags"]
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
  total,
  queue = "open",
}: {
  readonly flags: FraudFlags
  /** Server-side count for the active queue, before the 100-row window. */
  readonly total?: number
  readonly queue?: string
}) {
  // The loader already asks PostgREST for an exact count and the page is capped
  // at 100 rows, but the count was discarded — so past 100 flags the table
  // looked like the whole queue and an operator could reasonably conclude
  // there was nothing else to triage (ADM 04#6). Only shown when the window
  // actually truncates, so the ordinary case gains no chrome.
  const truncated = typeof total === "number" && total > flags.length

  return (
    <AdminPanel>
      <SectionHeader
        title="Fraud flags"
        description={QUEUE_DESCRIPTION[queue] ?? QUEUE_DESCRIPTION.all}
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {truncated ? (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the newest{" "}
          <span className="numeric-tabular">{flags.length}</span> of{" "}
          <span className="numeric-tabular">{total}</span> flags in this queue.
        </p>
      ) : null}
      <DataTable
        caption="Admin fraud flag readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={flags}
        getRowKey={(flag) => flag.id}
        emptyState={
          <AdminEmptyState
            icon={AlertDiamondIcon}
            title={
              queue === "open" ? "No open fraud flags" : "No fraud flags yet"
            }
            description={
              queue === "open"
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
