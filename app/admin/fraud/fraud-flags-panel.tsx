import {
  AlertDiamondIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import { resolveFraudFlagAction } from "@/app/admin/actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  adminInputClasses,
  formatAdminDate,
} from "@/components/admin/support"
import {
  EmptyState,
  Icon,
  SectionHeader,
  type IconGlyph,
} from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import type { getAdminFraudSignals } from "@/lib/admin/data"

type FraudFlags = Awaited<ReturnType<typeof getAdminFraudSignals>>["fraudFlags"]

export function FraudFlagsPanel({
  flags,
}: {
  readonly flags: FraudFlags
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Fraud flags"
        description="Security support signals with masked customer context and bucketed location evidence."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      <DataTable
        caption="Admin fraud flag readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={flags}
        getRowKey={(flag) => flag.id}
        emptyState={
          <EmptyState
            icon={AlertDiamondIcon}
            title="No fraud flags yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        }
        columns={[
          {
            key: "signal",
            header: "Signal",
            cell: (flag) => (
              <span className="font-bold">
                {flag.signal.replaceAll("_", " ")}
              </span>
            ),
          },
          {
            key: "cycle-stamp",
            header: "Cycle stamp",
            cell: (flag) => flag.cycleStampNumber ?? "-",
          },
          {
            key: "location-status",
            header: "Location status",
            cell: (flag) => (
              <span className="font-bold">{flag.locationStatus}</span>
            ),
          },
          {
            key: "distance",
            header: "Distance",
            cell: (flag) => flag.distanceBucket,
          },
          {
            key: "accuracy",
            header: "Accuracy",
            cell: (flag) => flag.accuracyBucket,
          },
          {
            key: "confidence",
            header: "Confidence",
            cell: (flag) => flag.confidence,
          },
          {
            key: "reason",
            header: "Reason",
            cell: (flag) => flag.reason.replaceAll("_", " "),
          },
          {
            key: "merchant",
            header: "Merchant",
            cell: (flag) => flag.merchant,
          },
          {
            key: "customer",
            header: "Customer",
            cell: (flag) => (
              <span className="text-muted-foreground">
                {flag.maskedCustomer}
              </span>
            ),
          },
          {
            key: "severity",
            header: "Severity",
            cell: (flag) => (
              <StatusPill tone="warning">{flag.severity}</StatusPill>
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
              <time className="text-muted-foreground" dateTime={flag.created_at}>
                {formatAdminDate(flag.created_at)}
              </time>
            ),
          },
          {
            key: "actions",
            header: "Review",
            cell: (flag) => <FraudFlagActions flagId={flag.id} />,
          },
        ]}
        mobileCard={(flag) => (
          <AdminRecordCard
            title={flag.signal.replaceAll("_", " ")}
            status={
              <>
                <StatusPill tone="warning">{flag.severity}</StatusPill>
                <StatusPill>{flag.status}</StatusPill>
              </>
            }
            fields={[
              { label: "Merchant", value: flag.merchant },
              { label: "Customer", value: flag.maskedCustomer },
              {
                label: "Cycle stamp",
                value: flag.cycleStampNumber ?? "-",
              },
              { label: "Location", value: flag.locationStatus },
              { label: "Distance", value: flag.distanceBucket },
              { label: "Reason", value: flag.reason.replaceAll("_", " ") },
              {
                label: "When",
                value: (
                  <time dateTime={flag.created_at}>
                    {formatAdminDate(flag.created_at)}
                  </time>
                ),
              },
            ]}
            action={<FraudFlagActions flagId={flag.id} compact />}
          />
        )}
      />
    </AdminPanel>
  )
}

function FraudFlagActions({
  flagId,
  compact = false,
}: {
  readonly flagId: string
  readonly compact?: boolean
}) {
  return (
    <div className={compact ? "grid gap-2" : "grid min-w-64 gap-2"}>
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
    <form action={resolveFraudFlagAction} className="grid gap-2">
      <input type="hidden" name="fraudFlagId" value={flagId} />
      <input type="hidden" name="status" value={status} />
      <AdminField label="Reason">
        <input
          name="reason"
          required
          minLength={4}
          className={adminInputClasses}
        />
      </AdminField>
      <Button type="submit" variant={variant} className="justify-start">
        <Icon icon={icon} size={16} />
        {label}
      </Button>
    </form>
  )
}
