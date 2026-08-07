import { Shield01Icon } from "@hugeicons/core-free-icons"

import { AdminLookupErrorState } from "@/components/admin/lookup-controls"
import {
  AdminEmptyState,
  AdminPanel,
  SourceLabel,
  StatusPill,
  formatAdminDate,
} from "@/components/admin/support"
import { SectionHeader } from "@/components/brand"
import { ActivityFeed } from "@/components/data/activity-feed"
import type { AdminDataRequestActivityRow } from "@/lib/admin/data"
import {
  dataRequestAgeCopy,
  describeDataRequestAge,
  DATA_REQUEST_WINDOW_DAYS,
} from "@/lib/admin/data-request-status"

/**
 * Lifecycle view for logged data requests (ADM-P2-18): pending manual
 * requests with their age against the statutory window, plus completed
 * exports/erasures — so tracking an in-flight GDPR request no longer means
 * grepping the audit page by eye. Read-only; audit_logs stays the source of
 * truth.
 */
export function LoggedRequestsPanel({
  requests,
}: {
  readonly requests: AdminDataRequestActivityRow[] | null
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Logged data requests"
        description={`Recent requests from the audit trail with their age against the ${DATA_REQUEST_WINDOW_DAYS}-day response window. Exports and erasures complete at the moment they are logged.`}
        actions={<SourceLabel>Source: audit_logs</SourceLabel>}
      />
      {requests ? (
        <ActivityFeed
          aria-label="Logged data requests"
          items={requests.map((request) => toFeedItem(request))}
          emptyState={
            <AdminEmptyState
              icon={Shield01Icon}
              title="No data requests logged yet"
              description="Requests logged through the workflow above will appear here with their response deadline."
              padded={false}
            />
          }
        />
      ) : (
        <AdminLookupErrorState title="Data request readback unavailable" />
      )}
    </AdminPanel>
  )
}

function toFeedItem(request: AdminDataRequestActivityRow) {
  const pending = request.action === "data_request_logged"
  const age = describeDataRequestAge(request.createdAt)

  return {
    id: request.id,
    tone: pending
      ? age.overdue
        ? ("accent" as const)
        : ("sun" as const)
      : ("leaf" as const),
    title: (
      <span className="flex flex-wrap items-center gap-2">
        {requestTitle(request)}
        {pending ? (
          <StatusPill tone={age.overdue ? "danger" : "warning"}>
            {age.overdue ? "overdue" : "open"}
          </StatusPill>
        ) : (
          <StatusPill tone="good">completed</StatusPill>
        )}
      </span>
    ),
    description: `${request.maskedCustomer} · ${request.merchant}${
      request.channel ? ` · via ${request.channel.replaceAll("_", " ")}` : ""
    }`,
    metadata: (
      <span>
        {pending ? `${dataRequestAgeCopy(age)} · ` : ""}
        <time dateTime={request.createdAt}>
          {formatAdminDate(request.createdAt)}
        </time>
      </span>
    ),
  }
}

function requestTitle(request: AdminDataRequestActivityRow) {
  if (request.action === "customer_data_exported") return "Export completed"
  if (request.action === "customer_pii_erased") return "Erasure completed"
  const type = request.requestType?.replaceAll("_", " ")
  return type
    ? `${type.charAt(0).toUpperCase()}${type.slice(1)} request`
    : "Data request"
}
